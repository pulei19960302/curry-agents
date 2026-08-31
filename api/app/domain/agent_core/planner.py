from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID, uuid4


# 计划执行的步骤状态
class PlanStepStatus(StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


# PlannerAgent 生成的单个任务步骤
@dataclass(slots=True)
class PlanStep:
    # id
    id: UUID

    # 标题
    title: str

    # 描述
    description: str

    # 输出
    expected_output: str

    # 状态
    status: PlanStepStatus = PlanStepStatus.pending


# PlannerAgent 对用户任务生成的完整计划。
@dataclass(slots=True)
class AgentPlan:
    id: UUID
    title: str
    goal: str
    steps: list[PlanStep]

    # 记录任务来源 llm 和fallback
    source: str


# 快捷的创建方式
def create_agent_plan(
        title: str,
        goal: str,
        steps: list[PlanStep],
        source: str,
) -> AgentPlan:
    """统一创建计划对象，避免应用层手动生成 plan id。"""

    return AgentPlan(
        id=uuid4(),
        title=title,
        goal=goal,
        steps=steps,
        source=source,
    )


def create_plan_step(
        title: str,
        description: str,
        expected_output: str,
) -> PlanStep:
    """统一创建计划步骤，默认状态为 pending。"""

    return PlanStep(
        id=uuid4(),
        title=title,
        description=description,
        expected_output=expected_output,
    )
