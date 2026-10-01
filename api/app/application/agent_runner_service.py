from asyncio import CancelledError

from collections.abc import AsyncIterator
from dataclasses import dataclass
from fastapi import Request
from uuid import UUID

from app.application.planner_service import PlannerService
from app.application.react_agent_service import ReActAgentService
from app.application.session_service import SessionService
from app.application.unit_of_work import UnitOfWork
from app.domain.sessions.entities import Session, SessionEvent


@dataclass(slots=True)
class AgentRunnerStreamItem:
    """
        Agent Runner 推给 HTTP/SSE 层的一条可观察输出。
       `name` 对应 SSE event 名称；`payload` 保留领域对象或简单字典。
       路由层负责把领域对象转换成 Pydantic 响应模型，避免应用服务依赖 HTTP 细节。
    """

    name: str
    payload: Session | SessionEvent | dict


class AgentRunnerService:
    """统一编排一次会话任务的主执行链路。

        把前面分散在路由里的步骤收敛到这里：
        1. 标记会话运行中。
        2. 写入用户消息和 message_created 事件。
        3. 使用 Planner 生成 plan_created。
        4. 使用 ReAct 按步骤执行并持续产出事件。
        5. 读取最终会话状态并发出 stream_done。
    """

    def __init__(
            self,
            *,
            session_service: SessionService,
            planner_service: PlannerService,
            react_service: ReActAgentService
    ):
        self.session_service = session_service
        self.planner_service = planner_service
        self.react_service = react_service

    @classmethod
    def from_uow(
            cls,
            uow: UnitOfWork,
            *,
            planner_service: PlannerService | None = None,
    ) -> "AgentRunnerService":
        """用同一个 UnitOfWork 构建 Runner，保证执行链路使用同一事务入口。"""
        return cls(
            session_service=SessionService(uow),
            planner_service=planner_service or PlannerService(uow),
            react_service=ReActAgentService(uow),
        )

    # 运行一次用户消息驱动的 Agent 任务

    async def stream_user_message(
            self,
            session_id: UUID,
            content: str,
            request: Request | None = None,
    ) -> AsyncIterator[AgentRunnerStreamItem]:
        """把用户消息转换成可流式观察的 Agent 执行过程。"""

        plan_event_id: UUID | None = None
        message = None
        running_acquired = False

        # StreamingResponse 返回后 HTTP 状态已经基本确定为 200，
        # 因此流内的异常必须转换成 SSE 事件，而不能继续向外抛出。
        try:
            # 会话先进入 running，前端可以立即展示任务开始。
            running_session = await self.session_service.mark_running(session_id)
            running_acquired = True

            yield AgentRunnerStreamItem(
                name="session_status",
                payload=running_session,
            )

            if request is not None and await request.is_disconnected():
                await self.session_service.mark_stopped_if_running(session_id)
                return

            # 写入用户消息，并把 message_created 推给前端时间线。
            message, message_event = await self.session_service.create_user_message(
                session_id=session_id,
                content=content,
            )

            yield AgentRunnerStreamItem(
                name=message_event.type.value,
                payload=message_event,
            )

            if request is not None and await request.is_disconnected():
                await self.session_service.mark_stopped_if_running(session_id)
                return

            # 生成计划。Planner 内部会读取上下文快照和长期记忆。
            _plan, plan_event = await self.planner_service.create_plan(
                session_id=session_id,
                task=content,
            )
            plan_event_id = plan_event.id

            yield AgentRunnerStreamItem(
                name=plan_event.type.value,
                payload=plan_event,
            )

            if request is not None and await request.is_disconnected():
                await self.session_service.mark_stopped_if_running(session_id)
                return

            # 执行计划。ReAct 内部会持续写 step/tool/task 事件。
            async for event in self.react_service.stream_latest_plan(
                    session_id,
                    plan_event_id=plan_event.id,
            ):
                if request is not None and await request.is_disconnected():
                    await self.session_service.mark_stopped_if_running(session_id)
                    return

                yield AgentRunnerStreamItem(
                    name=event.type.value,
                    payload=event,
                )

            # 推送最终会话状态和 stream_done，前端据此收尾 loading 状态。
            final_session = await self.session_service.get_session(session_id)
            yield AgentRunnerStreamItem(
                name="session_status",
                payload=final_session,
            )
            yield AgentRunnerStreamItem(
                name="stream_done",
                payload={
                    "session_id": str(session_id),
                    "status": final_session.status.value,
                    "success": final_session.status.value == "idle",
                    "message": self._message_payload(message),
                },
            )

        except CancelledError:
            await self.session_service.rollback()
            if running_acquired:
                await self.session_service.mark_stopped_if_running(session_id)
            raise

        except Exception as error:
            if not running_acquired:
                # mark_running 失败可能表示 session 不存在或已有任务运行中，
                # 不能把它再标记为 failed，只能返回流级错误。
                yield AgentRunnerStreamItem(
                    name="stream_error",
                    payload={
                        "session_id": str(session_id),
                        "code": getattr(error, "code", 500),
                        "message": getattr(error, "message", str(error)),
                        "status": "rejected",
                    },
                )
                yield AgentRunnerStreamItem(
                    name="stream_done",
                    payload={
                        "session_id": str(session_id),
                        "status": "rejected",
                        "success": False,
                    },
                )
                return

            # 任务已经抢占成功，后续异常需要持久化为 task_error，
            # 然后通过 SSE 通知前端，而不是让 200 流直接断开。
            error_event = await self.react_service.record_task_error(
                session_id=session_id,
                plan_event_id=plan_event_id,
                error=error,
            )
            yield AgentRunnerStreamItem(
                name=error_event.type.value,
                payload=error_event,
            )

            final_session = await self.session_service.get_session(session_id)
            yield AgentRunnerStreamItem(
                name="session_status",
                payload=final_session,
            )
            yield AgentRunnerStreamItem(
                name="stream_done",
                payload={
                    "session_id": str(session_id),
                    "status": final_session.status.value,
                    "success": False,
                },
            )

    @staticmethod
    def _message_payload(message) -> dict | None:
        if message is None:
            return None

        return {
            "id": str(message.id),
            "session_id": str(message.session_id),
            "role": message.role.value,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
        }

    # 运行已有计划，供同步接口和后台任务复用
    async def execute_latest_plan(self, session_id: UUID) -> list[SessionEvent]:
        """执行会话最近一次计划，保持旧接口兼容。"""

        return await self.react_service.execute_latest_plan(session_id)
