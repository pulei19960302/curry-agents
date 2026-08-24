from typing import Protocol
from uuid import UUID

from app.domain.sessions.entities import (
    Session, SessionMessage,
    SessionEventType, SessionEvent
)


# 封装session表数据访问协议
class SessionRepository(Protocol):
    async def add(self, title: str) -> Session: ...

    async def get(self, session_id: UUID) -> Session | None: ...

    async def list_active(self) -> list[Session]: ...

    async def soft_delete(self, session_id: UUID) -> None: ...

    # 更新会话的 updated_at
    async def touch(self, session_id: UUID) -> None: ...



# 封装session message相关
class SessionMessageRepository(Protocol):

    async def add_user_message(self, session_id: UUID, content: str) -> SessionMessage: ...

    async def list_by_session(self, session_id: UUID) -> list[SessionMessage]: ...


# 封装session 事件触发
class SessionEventRepository(Protocol):
    async def add(self, session_id: UUID, event_type: SessionEventType, payload: dict) -> SessionEvent: ...

    async def list_by_session(self, session_id: UUID) -> list[SessionEvent]: ...
