import json
from uuid import UUID

from app.application.llm_service import LLMService
from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
from app.domain.agent_core.planner import AgentPlan, PlanStep, create_plan_step, create_agent_plan
from app.domain.llm.entities import LLMMessage
from app.domain.sessions.entities import SessionEvent, SessionEventType


# 它负责把用户任务转换成结构化计划，并把计划保存成 session event。

class PlannerService:

    def __init__(
            self,
            uow: UnitOfWork,
            llm_service: LLMService | None = None,
    ) -> None:
        self.uow = uow
        self.llm_service = llm_service or LLMService()

    async def create_plan(self, session_id: UUID, task: str) -> tuple[AgentPlan, SessionEvent]:

        clean_task = task.strip()
        if not clean_task:
            raise AppException(
                message="task is required",
                code=400,
                status_code=400,
            )

        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )

        plan = await self._generate_plan(clean_task)
        event = await self.uow.session_event.add(
            session_id=session_id,
            event_type=SessionEventType.plan_created,
            payload=self._plan_to_payload(plan),
        )
        await self.uow.sessions.touch(session_id)
        await self.uow.commit()
        return plan, event

    # 使用 LLM 生成结构化计划；不可用时返回教学 fallback

    async def _generate_plan(self, clean_task: str) -> AgentPlan:
        try:
            result = await self.llm_service.chat(
                messages=[
                    LLMMessage(
                        role="system",
                        content=(
                            "你是一个 PlannerAgent。请把用户任务拆成 3 到 5 个可执行步骤。"
                            "只返回 JSON，不要返回 Markdown。JSON 格式为："
                            '{"title":"计划标题","goal":"目标","steps":['
                            '{"title":"步骤标题","description":"步骤说明","expected_output":"预期输出"}'
                            "]}"
                        ),
                    ),
                    LLMMessage(role="user", content=clean_task),
                ],
                temperature=0.2,
                max_tokens=1200,
            )
            return self._parse_llm_plan(task=clean_task, content=result.content)
        except AppException:
            # 没配置 API Key 或 provider 出错时，仍然给出可运行的教学计划。
            # 这样第 18 章不会因为外部服务不可用而无法验证主流程。
            return self._build_fallback_plan(clean_task)

    def _parse_llm_plan(self, task: str, content: str) -> AgentPlan:
        """把模型返回文本解析成 AgentPlan。"""

        try:
            data = json.loads(self._strip_code_fence(content))
        except json.JSONDecodeError:
            return self._build_fallback_plan(task)

        steps = [
            create_plan_step(
                title=str(item.get("title", "")).strip() or "未命名步骤",
                description=str(item.get("description", "")).strip() or "补充步骤说明",
                expected_output=str(item.get("expected_output", "")).strip()
                                or "完成该步骤的可检查结果",
            )
            for item in data.get("steps", [])
            if isinstance(item, dict)
        ]

        if not steps:
            return self._build_fallback_plan(task)

        return create_agent_plan(
            title=str(data.get("title", "")).strip() or "任务执行计划",
            goal=str(data.get("goal", "")).strip() or task,
            steps=steps[:5],
            source="llm",
        )

    def _strip_code_fence(self, content: str) -> str:
        """去掉 ```json ... ``` 这类包裹，提升 JSON 解析成功率。"""

        clean_content = content.strip()
        if clean_content.startswith("```"):
            lines = clean_content.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            return "\n".join(lines).strip()
        return clean_content

    # 外部模型不可用时，生成稳定的教学计划。"
    def _build_fallback_plan(self, task: str) -> AgentPlan:
        """外部模型不可用时，生成稳定的教学计划。"""

        steps: list[PlanStep] = [
            create_plan_step(
                title="明确任务目标",
                description=f"梳理“{task}”的最终交付物、边界和验收标准。",
                expected_output="得到清晰的目标描述和验收清单。",
            ),
            create_plan_step(
                title="拆解执行步骤",
                description="把任务拆成几个可以独立完成和验证的小步骤。",
                expected_output="得到可执行的步骤列表。",
            ),
            create_plan_step(
                title="逐步实现和检查",
                description="按步骤完成任务，并在每一步后检查输出是否符合预期。",
                expected_output="得到可运行、可检查的阶段结果。",
            ),
            create_plan_step(
                title="总结结果和下一步",
                description="整理最终输出、风险点和后续可以继续扩展的方向。",
                expected_output="得到最终总结和后续建议。",
            ),
        ]
        return create_agent_plan(
            title="任务执行计划",
            goal=task,
            steps=steps,
            source="fallback",
        )

    def _plan_to_payload(self, plan: AgentPlan) -> dict:
        """把计划对象转换成可以存入 JSONB 的字典。"""

        return {
            "id": str(plan.id),
            "plan_id": str(plan.id),
            "title": plan.title,
            "goal": plan.goal,
            "source": plan.source,
            "steps": [
                {
                    "id": str(step.id),
                    "title": step.title,
                    "description": step.description,
                    "expected_output": step.expected_output,
                    "status": step.status.value,
                }
                for step in plan.steps
            ],
        }
