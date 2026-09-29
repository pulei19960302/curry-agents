from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class MemoryKind(StrEnum):
    """长期记忆的业务分类。

       第 40 章先使用四类稳定分类：
       - user_preference：用户偏好，例如喜欢中文解释、希望代码多注释。
       - project_fact：项目事实，例如项目使用 FastAPI、Next.js、PostgreSQL。
       - task_experience：历史任务经验，例如某类任务应该先跑哪些验证。
       - constraint：长期约束，例如不要暴露密钥、不要提交某类文件。
       """
    user_preference = "user_preference"  # 用户希望系统如何回答或工作。
    project_fact = "project_fact"  # 项目本身长期稳定的背景信息。
    task_experience = "task_experience"  # 历史任务中总结出的执行经验。
    constraint = "constraint"  # 后续任务必须遵守的限制。


@dataclass(slots=True)
class AgentMemory:
    """跨会话保存的一条长期记忆。"""
    id: UUID

    kind: MemoryKind

    content: str

    # 重要性
    importance: int

    enabled: bool

    source_session_id: UUID | None

    source_event_id: UUID | None

    expires_at: datetime | None

    created_at: datetime | None

    updated_at: datetime | None

    deleted_at: datetime | None

    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(slots=True)
class MemoryCandidate:
    """从消息或事件中抽取出来、等待确认的记忆候选。"""

    kind: MemoryKind

    content: str

    importance: int

    reason: str

    source_session_id: UUID | None = None

    source_event_id: UUID | None = None

    metadata: dict[str, object] = field(default_factory=dict)
