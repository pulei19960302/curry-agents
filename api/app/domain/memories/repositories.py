from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.memories.entities import AgentMemory, MemoryKind


class AgentMemoryRepository(Protocol):
    """
        长期记忆仓库协议。
        应用服务只依赖这个协议，不直接依赖 SQLAlchemy。
    """

    async def add(
            self,
            *,
            kind: MemoryKind,
            content: str,
            importance: int,
            source_session_id: UUID | None,
            source_event_id: UUID | None,
            expires_at: datetime | None,
            metadata: dict[str, object],
    ) -> AgentMemory: ...

    async def get(self, memory_id: UUID) -> AgentMemory | None: ...

    async def list_active(
            self,
            *,
            kind: MemoryKind | None = None,
            enabled_only: bool = False,
            limit: int = 100,
    ) -> list[AgentMemory]: ...

    async def update(
            self,
            memory_id: UUID,
            *,
            content: str | None = None,
            importance: int | None = None,
            enabled: bool | None = None,
            expires_at: datetime | None = None,
            metadata: dict[str, object] | None = None,
    ) -> AgentMemory | None: ...

    async def soft_delete(self, memory_id: UUID | None) -> AgentMemory | None: ...
