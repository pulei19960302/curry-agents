from typing import Protocol
from uuid import UUID

from app.domain.sessions.entities import Session


# 封装session表数据访问协议
class SessionRepository(Protocol):
    async def add(self, title: str) -> Session: ...

    async def get(self, session_id: UUID) -> Session | None: ...

    async def list_active(self) -> list[Session]: ...

    async def soft_delete(self, session_id: UUID) -> None: ...
