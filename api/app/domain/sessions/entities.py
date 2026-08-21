from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


# 枚举
class SessionStatus(StrEnum):
    idle = 'idle'
    running = 'running'
    stopped = 'stopped'
    failed = 'failed'

# 这里的 Session 是领域实体，不是数据库模型。

@dataclass(slots=True)
class Session:
    id: UUID
    title: str
    status: SessionStatus
    unread_count: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
