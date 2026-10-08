import re
from asyncio import CancelledError
from collections.abc import AsyncIterator
from uuid import UUID

from app.application.content_generation_service import ContentGenerationService
from app.application.context_engineering_service import ContextEngineeringService
from app.application.llm_service import LLMService
from app.application.tool_selection_service import ModelToolSelectionService
from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
from app.domain.context_engineering.entities import MemoryContext
from app.domain.sessions.entities import SessionEvent, SessionEventType, SessionStatus
from app.infrastructure.agent_tools.builtin import build_builtin_tool_registry

# URL 可能紧接在中文句子中，例如："访问 https://www.baidu.com，等待加载"。
# 因此不能只按空白分割；匹配到中文标点、空白或常见句末符号时就停止。
_URL_PATTERN = re.compile(
    r"(?:https?://|www\.)[^\s，。！？、()（）\[\]{}<>\"']+",
    re.IGNORECASE,
)


class ReActAgentService:
    """执行最新计划，并把每个步骤的过程持久化为会话事件。

    这是简化版 ReAct：它不会在每一步重新调用 LLM 推理，而是根据计划目标和
    步骤文本中的关键词确定性地选择一个已注册工具。工具的输入、输出和步骤
    状态会持续写入 session_event，前端可据此展示执行进度。

    正常执行时，事件顺序为：
    ``plan_created -> for[step_started -> tool_called -> step_completed]-> task_done``。
    每一个计划步骤都会重复中间三个事件。

    Example:
        若计划目标为“访问 https://example.com 并截图”，包含“打开网页”和
        “保存截图”两个步骤，第一步会选择 ``browser_open``，第二步会选择
        ``browser_screenshot``。对应的工具输入和输出都会出现在 ``tool_called``
        事件中，前端可按 ``step_id`` 把这些事件归属到正确步骤。
    """

    def __init__(self, uow: UnitOfWork):
        """注入工作单元，并创建本次执行可用的工具注册表。

        工作单元中的会话仓储、事件仓储共享同一个数据库会话，因此本服务中的
        状态更新和事件写入会在一次 ``uow.commit()`` 中提交。
        """
        self.uow = uow
        # 注册文本、文件、Shell、浏览器等工具，后续按工具名取得并调用。
        self.registry = build_builtin_tool_registry()
        llm_service = LLMService()
        self.tool_selector = ModelToolSelectionService(
            registry=self.registry,
            llm_service=llm_service,
        )
        self.content_generation_service = ContentGenerationService(
            llm_service=llm_service,
        )

    async def execute_latest_plan(self, session_id: UUID) -> list[SessionEvent]:
        """执行指定会话最近一次 ``plan_created`` 事件中的全部步骤。

        Args:
            session_id: 要执行计划的会话 ID。

        Returns:
            本次新写入的事件。正常时每个步骤产生 3 个事件，末尾额外产生
            1 个 ``task_done``；发生异常时返回此前已产生的事件和 ``task_error``。

        Raises:
            AppException: 会话不存在、没有计划，或者计划没有步骤时抛出。

        仓储的 add() 会先 flush，因此事件在当前事务中已经可见，但在 commit
        前不会对其他事务生效。某一步失败时，当前实现不会回滚之前的步骤事件，
        而是追加一个任务级 ``task_error`` 后一起提交，保留执行轨迹。
        """
        # 先确认会话存在，避免为无效 session 写入事件或更新状态。
        session = await self.uow.sessions.get(session_id)

        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )

        # 事件仓储按创建时间正序返回；静态方法会从末尾找到最近的计划。
        events = await self.uow.session_event.list_by_session(session_id)
        plan_event = self._find_latest_plan_event(events)
        # plan_created 的 payload 本身就是计划快照，无需额外查询计划表。
        plan = plan_event.payload
        steps = plan.get("steps", [])

        if not steps:
            raise AppException(
                message="plan has no steps",
                code=400,
                status_code=400,
            )

        created_events: list[SessionEvent] = []
        # 一旦开始执行步骤，会话状态进入 running。
        await self.uow.sessions.update_status(session_id, SessionStatus.running)

        context_snapshot = await ContextEngineeringService(self.uow).build_snapshot(
            session_id=session_id,
            task=str(plan.get("goal", "")),
        )

        memory_context = context_snapshot.memory_context

        try:
            # 严格串行执行，index 从 1 开始，便于事件和前端直接显示步骤序号。
            for index, step in enumerate(steps, start=1):
                created_events.extend(
                    await self._execute_step(
                        session_id=session_id,
                        step=step,
                        index=index,
                        plan=plan,
                        memory_context=memory_context
                    )
                )
            # 仅全部步骤没有异常时，才写入整个任务完成事件。
            done_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_done,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": "计划步骤已全部执行完成。",
                    "memory_ids": [str(item.id) for item in memory_context.items],
                    "memory_count": len(memory_context.items),
                },
            )
            created_events.append(done_event)

            # 成功后恢复 idle，同时刷新会话的最近活动时间。
            await self.uow.sessions.update_status(session_id, SessionStatus.idle)
            await self.uow.sessions.touch(session_id)

            # 一次性提交状态更新和本次产生的全部事件。
            await self.uow.commit()
            return created_events


        except Exception as error:
            # 工具或事件写入失败时没有 step_failed 事件；目前使用任务级
            # task_error 记录失败原因，并保留此前已成功写入的事件。
            error_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_error,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": str(error),
                },
            )
            await self.uow.sessions.update_status(session_id, SessionStatus.failed)
            # task_error 和 failed 状态也需要提交，否则调用方无法看到失败结果。
            await self.uow.commit()
            return [*created_events, error_event]

    async def _execute_step(
            self,
            session_id: UUID,
            plan: dict,
            step: dict,
            index: int,
            memory_context: MemoryContext
    ) -> list[SessionEvent]:
        """执行一个步骤，并生成“开始、工具调用、完成”三个事件。

        Args:
            session_id: 当前执行所属会话。
            plan: plan_created 事件中保存的完整计划 payload。
            step: 当前步骤的字典数据。
            index: 从 1 开始的步骤序号。

        Returns:
            固定按 ``step_started``、``tool_called``、``step_completed`` 排列的
            三个事件。

        如果工具调用抛出异常，``step_completed`` 不会创建；异常会继续向上交给
        ``execute_latest_plan`` 写入 ``task_error`` 并设置会话为 failed。
        """

        # 兼容 payload 可能使用 id 或 plan_id 两种字段名的已有数据。
        plan_id = plan.get("id") or plan.get("plan_id")
        step_id = step.get("id")

        # 先写入开始事件，前端即可根据 step_id 将对应步骤显示为执行中。
        started_event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.step_started,
            payload={
                "plan_id": plan_id,
                "step_id": step_id,
                "index": index,
                "title": step.get("title", ""),
            }
        )

        # 选择并执行工具。当前工具接口同步返回，因此这里没有 await。
        tool_result = await self._call_tool_for_step(plan, step, index, memory_context)

        # 保存工具名、工具参数和输出，便于前端展示与后续问题排查。
        tool_called_event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.tool_called,
            payload={
                "plan_id": plan_id,
                "step_id": step_id,
                "tool_name": tool_result["tool_name"],
                "arguments": tool_result["arguments"],
                "output": tool_result["output"],
                "memory_ids": [str(item.id) for item in memory_context.items],
                "memory_count": len(memory_context.items),
            },
        )

        # 只有工具正常返回，当前步骤才会生成完成事件；summary 复用工具输出。
        completed_event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.step_completed,
            payload={
                "plan_id": plan_id,
                "step_id": step_id,
                "index": index,
                "title": step.get("title", ""),
                "summary": tool_result["output"],
            },
        )

        return [started_event, tool_called_event, completed_event]

    # 以流式方式执行当前会话的最新计划
    async def stream_latest_plan(self, session_id: UUID, plan_event_id: UUID) -> AsyncIterator[SessionEvent]:
        """
            边执行计划边产出事件。
            这个方法把 step_started、tool_called、step_completed、task_done
            逐个 yield 给 HTTP SSE 层，让中间对话流可以实时更新。
        """

        plan_event = await self.uow.session_event.get(
            session_id=session_id,
            event_id=plan_event_id
        )

        if plan_event is None or plan_event.type is not SessionEventType.plan_created:
            raise AppException(
                message="plan not found or plan type is not plan_created",
                code=404,
                status_code=404,
            )
        # 这里保证了一定是plan_created
        plan = plan_event.payload
        steps = plan.get("steps", [])

        if not steps:
            raise AppException(
                message="plan has no steps",
                code=400,
                status_code=400,
            )

        #  Planner 和 ReAct 复用同一套上下文构建方式。
        context_snapshot = await ContextEngineeringService(self.uow).build_snapshot(
            session_id=session_id,
            task=str(plan.get("goal", "")),
        )

        memory_context = context_snapshot.memory_context

        current_step: dict | None = None
        current_index = 0

        try:
            for index, step in enumerate(steps, start=1):
                current_step = step
                current_index = index

                # 判断当前会话状态, 每一次运行步骤的时候要判断当前会话状态，如果状态不对，就停止步骤执行
                if await self._is_stopped(session_id):
                    yield await self._record_stopped(
                        session_id=session_id,
                        plan=plan,
                        current_step=current_step,
                        current_index=current_index,
                    )
                    return

                started_event = await self.uow.session_event.add(
                    session_id=session_id,
                    event_type=SessionEventType.step_started,
                    payload={
                        "plan_id": plan.get("id") or plan.get("plan_id"),
                        "step_id": step.get("id"),
                        "index": index,
                        "title": step.get("title", ""),
                    }
                )
                await self.uow.commit()
                yield started_event

                # 执行工具
                tool_result = await self._call_tool_for_step(
                    plan,
                    step,
                    index,
                    memory_context,
                )

                tool_call_event = await self.uow.session_event.add(
                    session_id=session_id,
                    event_type=SessionEventType.tool_called,
                    payload={
                        "plan_id": plan.get("id") or plan.get("plan_id"),
                        "step_id": step.get("id"),
                        "tool_name": tool_result["tool_name"],
                        "arguments": tool_result["arguments"],
                        "output": tool_result["output"],
                        "memory_ids": [str(item.id) for item in memory_context.items],
                        "memory_count": len(memory_context.items),
                    },
                )
                await self.uow.commit()
                yield tool_call_event

                # 判断session 状态是不是停止
                if await self._is_stopped(session_id):
                    yield await self._record_stopped(
                        session_id,
                        plan,
                        current_step,
                        current_index,
                    )
                    return

                completed_event = await self.uow.session_event.add(
                    session_id=session_id,
                    event_type=SessionEventType.step_completed,
                    payload={
                        "plan_id": plan.get("id") or plan.get("plan_id"),
                        "step_id": step.get("id"),
                        "index": index,
                        "title": step.get("title", ""),
                        "summary": tool_result["output"],
                    },
                )
                await self.uow.commit()
                yield completed_event

            done_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_done,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": "计划步骤已全部执行完成。",
                    "memory_ids": [str(item.id) for item in memory_context.items],
                    "memory_count": len(memory_context.items),
                },
            )
            await self.uow.sessions.transition_status(
                session_id=session_id,
                expected_statuses=(SessionStatus.running,),
                target_status=SessionStatus.idle,
            )
            await self.uow.sessions.touch(session_id)
            await self.uow.commit()
            yield done_event

        except CancelledError:
            await self.uow.rollback()
            await self.uow.sessions.transition_status(
                session_id=session_id,
                expected_statuses=(SessionStatus.running,),
                target_status=SessionStatus.stopped,
            )
            await self.uow.commit()
            raise

        except Exception as error:
            yield await self.record_task_error(
                session_id=session_id,
                plan_event_id=plan_event_id,
                error=error,
                current_step=current_step,
                current_index=current_index,
            )

    # 一些辅助方法
    async def _is_stopped(self, session_id: UUID) -> bool:
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404
            )
        return session.status is SessionStatus.stopped

    async def _record_stopped(
            self,
            session_id: UUID,
            plan: dict,
            current_step: dict | None,
            current_index: int
    ) -> SessionEvent:
        payload = {
            "plan_id": plan.get("id") or plan.get("plan_id"),
            "message": "任务已停止。",
        }
        if current_step is not None:
            payload.update({
                "step_id": current_step.get("id"),
                "index": current_index,
                "title": current_step.get("title", ""),
            })

        event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.task_stopped,
            payload=payload,
        )
        await self.uow.commit()
        return event

    # 记录任务失败
    async def record_task_error(
            self,
            session_id: UUID,
            plan_event_id: UUID | None,
            error: Exception,
            current_step: dict | None = None,
            current_index: int = 0,
    ) -> SessionEvent:
        await self.uow.rollback()

        payload: dict = {
            "plan_event_id": str(plan_event_id) if plan_event_id else None,
            "message": str(error) or "任务执行失败",
        }
        if current_step is not None:
            payload.update({
                "step_id": current_step.get("id"),
                "index": current_index,
                "title": current_step.get("title", ""),
            })

        event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.task_error,
            payload=payload,
        )
        # 把会话的状态也变成失败
        await self.uow.sessions.transition_status(
            session_id=session_id,
            expected_statuses=(SessionStatus.running,),
            target_status=SessionStatus.failed,
        )
        await self.uow.commit()
        return event

    @staticmethod
    def _find_latest_plan_event(events: list[SessionEvent]) -> SessionEvent:
        """从事件流末尾倒序找出最新一条 ``plan_created`` 事件。

        事件仓储使用 created_at 正序查询，因而反向遍历遇到的第一个计划就是
        最近创建的计划。会话重新规划后，这能确保执行新计划而非旧计划。

        最新： 流式处理 暂时不用这个方法
        """

        for event in reversed(events):
            if event.type is SessionEventType.plan_created:
                return event

        raise AppException(
            message="plan not found",
            code=404,
            status_code=404,
        )

    async def _call_tool_for_step(self, plan: dict, step: dict, index: int,
                                  memory_context: MemoryContext) -> dict:
        """根据计划内容选择工具，并返回可写入事件的调用结果。

        当前选择器是确定性的关键词规则，而不是模型在运行时再次推理：

        1. 文本涉及截图时，选择打开网页或截图工具；
        2. 否则涉及网页访问时，选择 ``browser_open``；
        3. 标题含“拆/步骤/计划”时，选择 ``draft_plan``；
        4. 标题含“关键/重点”时，选择 ``extract_keywords``；
        5. 其他情况使用 ``summarize_text``。

        同时使用全局 ``plan.goal`` 和当前步骤的标题、描述、预期输出，是为了
        避免步骤被概括后丢失“访问网页、截图”等原始任务上下文。

        Returns:
            包含 ``tool_name``、``arguments``、``output`` 的字典，字段可直接
            放入 ``tool_called`` 事件的 payload。


            通过模型工具选择服务调用一个内置工具。
            ReAct 不再自己维护大段关键词分支。
            它把计划、步骤和长期记忆交给 ModelToolSelectionService：
            - 模型可用时，模型根据工具 schema 输出结构化 tool call。
            - 模型不可用或输出异常时，服务内部使用确定性 fallback。
        """

        decision = await self.tool_selector.call_tool_for_step(
            plan=plan,
            step=step,
            index=index,
            agent_context=self._render_memory_guidance(memory_context),
        )

        tool = self.registry.get(decision.tool_name)
        arguments = dict(decision.arguments)
        agent_context = self._render_memory_guidance(memory_context)

        # 去判断这个工具里面是否有需要模型生成的参数 generated_by_model=True。如果鱼
        for parameter in tool.definition.parameters:
            if not parameter.generated_by_model:
                continue

            arguments[parameter.name] = (
                await self.content_generation_service.generate_parameter(
                    plan=plan,
                    step=step,
                    tool_name=decision.tool_name,
                    parameter_name=parameter.name,
                    parameter_description=parameter.description,
                    current_arguments=arguments,
                    agent_context=agent_context,
                )
            )

        result = await self.tool_selector.execute_tool(
            tool_name=decision.tool_name,
            arguments=arguments,
        )
        return {
            "tool_name": result.tool_name,
            "arguments": result.arguments,
            "output": result.output,
        }

    @staticmethod
    def _render_memory_guidance(memory_context: MemoryContext) -> str:
        """
            把已检索记忆压缩成工具可读的指导文本。
            工具类型仍由当前任务文本决定，避免旧记忆中的“浏览器、搜索”等词
            误触发工具；选中工具后，文本类工具会收到这些长期约束和偏好。
        """

        return "\n".join(
            f"- [{item.kind.value}] {item.content}"
            for item in memory_context.items
        )
