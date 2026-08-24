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


# 消息用户
class MessageRole(StrEnum):
    user = 'user'
    assistant = 'assistant'
    system = 'system'


@dataclass(slots=True)
class SessionMessage:
    id: UUID
    session_id: UUID
    role: MessageRole
    content: str
    created_at: datetime



# session 事件类型
class SessionEventType(StrEnum):
    message_created = "message_created"


@dataclass(slots=True)
class SessionEvent:
    id: UUID
    session_id: UUID
    type: SessionEventType
    payload: dict
    created_at: datetime