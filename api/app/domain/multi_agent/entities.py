from dataclasses import dataclass


@dataclass(slots=True)
class MultiAgentRole:
    """多 Agent 协作中的角色定义。"""
    key: str
    name: str
    responsibility: str
    capability: str


@dataclass(slots=True)
class MultiAgentSubTask:
    """Manager Agent 拆出来的子任务。"""
    id: str
    assignee: str
    title: str
    instruction: str
    expected_output: str
    status: str
    output: str


@dataclass(slots=True)
class MultiAgentReview:
    """Reviewer Agent 对 Worker 输出的评审结果。"""
    reviewer: str
    status: str
    comments: list[str]
    improvement: str


@dataclass(slots=True)
class MultiAgentRunResult:
    """一次完整多 Agent 协作的结果。"""

    kind: str
    task: str
    manager: str
    roles: list[MultiAgentRole]
    subtasks: list[MultiAgentSubTask]
    review: MultiAgentReview
    final_answer: str
