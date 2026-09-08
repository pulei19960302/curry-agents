import re
from urllib.parse import urlparse
from uuid import UUID

from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
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
    ``plan_created -> step_started -> tool_called -> step_completed -> task_done``。
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

        try:
            # 严格串行执行，index 从 1 开始，便于事件和前端直接显示步骤序号。
            for index, step in enumerate(steps, start=1):
                created_events.extend(
                    await self._execute_step(
                        session_id=session_id,
                        step=step,
                        index=index,
                        plan=plan
                    )
                )
            # 仅全部步骤没有异常时，才写入整个任务完成事件。
            done_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_done,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": "计划步骤已全部执行完成。",
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
            index: int
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
        tool_result = self._call_tool_for_step(plan, step, index)

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

    @staticmethod
    def _find_latest_plan_event(events: list[SessionEvent]) -> SessionEvent:
        """从事件流末尾倒序找出最新一条 ``plan_created`` 事件。

        事件仓储使用 created_at 正序查询，因而反向遍历遇到的第一个计划就是
        最近创建的计划。会话重新规划后，这能确保执行新计划而非旧计划。
        """

        for event in reversed(events):
            if event.type is SessionEventType.plan_created:
                return event

        raise AppException(
            message="plan not found",
            code=404,
            status_code=404,
        )

    def _call_tool_for_step(self, plan: dict, step: dict, index: int) -> dict:
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
        """

        # goal 提供全局上下文，step_text 则只包含当前步骤自身的信息。
        goal = str(plan.get("goal", ""))
        title = str(step.get("title", ""))
        description = str(step.get("description", ""))
        expected_output = str(step.get("expected_output", ""))
        step_text = f"{title} {description} {expected_output}".strip()
        text = f"{goal} {step_text}".strip()

        if self._needs_browser_screenshot(text):
            # 包含截图意图时，第一步优先打开页面；其余步骤再截取当前页面。
            # 这是简化策略，不会记录某个 URL 是否确实已经被打开。
            if index == 1 or (
                    self._needs_browser_open(step_text)
                    and not self._needs_browser_screenshot(step_text)
            ):
                tool = self.registry.get("browser_open")
                arguments = {"url": self._extract_url(text)}
            else:
                tool = self.registry.get("browser_screenshot")
                arguments = {"full_page": True}
        elif self._needs_browser_open(text):
            tool = self.registry.get("browser_open")
            arguments = {"url": self._extract_url(text)}
        elif "拆" in title or "步骤" in title or "计划" in title:
            tool = self.registry.get("draft_plan")
            arguments = {"task": text}
        elif "关键" in title or "重点" in title:
            tool = self.registry.get("extract_keywords")
            arguments = {"text": text}
        else:
            tool = self.registry.get("summarize_text")
            arguments = {"text": text}

        # AgentTool.call 负责最小参数校验、调用 handler，并统一包装返回结果。
        result = tool.call(arguments)
        return {
            "tool_name": result.tool_name,
            "arguments": result.arguments,
            "output": result.output,
        }

    @staticmethod
    def _needs_browser_open(text: str) -> bool:
        """根据中文关键词判断文本是否表达网页访问意图。

        这是启发式字符串匹配，例如“打开网页”会命中；它不理解语义，也暂时
        不处理英文同义词。后续可由 LLM 的结构化工具调用替代。
        """

        keywords = ["网页", "网站", "浏览器", "访问", "打开", "页面"]
        return any(keyword in text for keyword in keywords)

    @staticmethod
    def _needs_browser_screenshot(text: str) -> bool:
        """根据中文关键词判断文本是否要求截取当前浏览器页面。"""

        keywords = ["截图", "截屏", "页面截图", "观察页面"]
        return any(keyword in text for keyword in keywords)

    @staticmethod
    def _extract_url(text: str) -> str:
        """从计划步骤中提取 URL，没有 URL 时使用稳定示例站点。

        正则会从连续文本中提取第一个以 http/https 或 www. 开头的地址，并在
        中文标点、空白等边界停止。例如“访问 https://www.baidu.com，等待加载”
        会正确提取为 ``https://www.baidu.com``，不会把“等待加载”拼进域名。
        ``www.baidu.com`` 这类无协议地址会补为 ``https://www.baidu.com``。

        计划没有明确 URL 时，会回退到 ``https://example.com``，以保证
        ``browser_open`` 的必填 ``url`` 参数始终存在。

        后续可让 LLM 在步骤 payload 中直接输出 url 字段，避免依赖字符串解析。
        """

        for match in _URL_PATTERN.finditer(text):
            # urlparse 只有看到协议时才会把主机名放进 netloc，因此为 www. 补充
            # https:// 后再校验，既支持 LLM 输出的完整 URL，也支持用户裸域名。
            # 英文句点和 ? 可能属于域名、路径或查询参数，正则不能把它们作为
            # 边界；仅在这里去掉 URL 结尾可能附带的英文句末标点。
            candidate = match.group().rstrip(".,!?")
            normalized_url = (
                candidate
                if candidate.lower().startswith(("http://", "https://"))
                else f"https://{candidate}"
            )
            parsed = urlparse(normalized_url)
            if parsed.scheme in {"http", "https"} and parsed.netloc:
                return normalized_url
        return "https://example.com"


# 示例计划：
# plan = {
#     "id": "plan-001",
#     "goal": "访问 https://example.com 并截图",
#     "steps": [
#         {
#             "id": "step-1",
#             "title": "打开网页",
#             "description": "访问目标网站",
#         },
#         {
#             "id": "step-2",
#             "title": "保存截图",
#             "description": "截取当前页面",
#         },
#     ],
# }
#
# 上述计划执行后会写入以下事件流：
# step-1
#   -> step_started
#   -> browser_open(url="https://example.com")
#   -> tool_called
#   -> step_completed
#
# step-2
#   -> step_started
#   -> browser_screenshot(full_page=True)
#   -> tool_called
#   -> step_completed
#
# 最后
#   -> task_done
