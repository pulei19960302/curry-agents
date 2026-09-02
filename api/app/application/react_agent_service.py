from uuid import UUID

from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
from app.domain.sessions.entities import SessionEvent, SessionEventType, SessionStatus
from app.infrastructure.agent_tools.builtin import build_builtin_tool_registry


# 本章先把计划步骤转成可观察事件，不引入后台队列。
class ReActAgentService:

    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        # 内置的工具
        self.registry = build_builtin_tool_registry()

    #  执行最近一次 plan_created 事件中的计划步骤
    async def execute_latest_plan(self, session_id: UUID) -> list[SessionEvent]:
        session = await self.uow.sessions.get(session_id)

        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )

        events = await self.uow.session_event.list_by_session(session_id)
        plan_event = self._find_latest_plan_event(events)
        plan = plan_event.payload
        steps = plan.get("steps", [])

        if not steps:
            raise AppException(
                message="plan has no steps",
                code=400,
                status_code=400,
            )

        created_events: list[SessionEvent] = []
        # 更新会话状态
        await self.uow.sessions.update_status(session_id, SessionStatus.running)

        try:
            for index, step in enumerate(steps, start=1):
                created_events.extend(
                    await self._execute_step(
                        session_id=session_id,
                        step=step,
                        index=index,
                        plan=plan
                    )
                )
            done_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_done,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": "计划步骤已全部执行完成。",
                },
            )
            created_events.append(done_event)
            await self.uow.sessions.update_status(session_id, SessionStatus.idle)
            await self.uow.sessions.touch(session_id)
            await self.uow.commit()
            return created_events


        except Exception as error:
            error_event = await self.uow.session_event.add(
                session_id=session_id,
                event_type=SessionEventType.task_error,
                payload={
                    "plan_id": plan.get("id") or plan.get("plan_id"),
                    "message": str(error),
                },
            )
            await self.uow.sessions.update_status(session_id, SessionStatus.failed)
            await self.uow.commit()
            return [*created_events, error_event]

    # 开始执行计划里面的步骤
    async def _execute_step(
            self,
            session_id: UUID,
            plan: dict,
            step: dict,
            index: int
    ) -> list[SessionEvent]:

        plan_id = plan.get("id") or plan.get("plan_id")
        step_id = step.get("id")

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

        tool_result = self._call_tool_for_step(step)

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

    # 根据event倒叙查找最新的plan_created事件
    def _find_latest_plan_event(self, events: list[SessionEvent]) -> SessionEvent:

        for event in reversed(events):
            if event.type is SessionEventType.plan_created:
                return event

        raise AppException(
            message="plan not found",
            code=404,
            status_code=404,
        )

    # 模拟执行工具
    def _call_tool_for_step(self, step: dict) -> dict:

        title = str(step.get("title", ""))
        description = str(step.get("description", ""))
        text = f"{title} {description}".strip()

        if "拆" in title or "步骤" in title or "计划" in title:
            tool = self.registry.get("draft_plan")
            arguments = {"task": text}
        elif "关键" in title or "重点" in title:
            tool = self.registry.get("extract_keywords")
            arguments = {"text": text}
        else:
            tool = self.registry.get("summarize_text")
            arguments = {"text": text}

        result = tool.call(arguments)
        return {
            "tool_name": result.tool_name,
            "arguments": result.arguments,
            "output": result.output,
        }
