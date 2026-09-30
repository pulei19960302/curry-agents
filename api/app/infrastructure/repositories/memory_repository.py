from datetime import datetime, UTC
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.domain.memories.entities import MemoryKind, AgentMemory
from app.domain.memories.repositories import AgentMemoryRepository
from app.infrastructure.database.models import AgentMemoryModel


class SqlAlchemyAgentMemoryRepository(AgentMemoryRepository):

    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session

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
    ) -> AgentMemory:
        model = AgentMemoryModel(
            kind=kind.value,
            content=content,
            importance=importance,
            source_session_id=source_session_id,
            source_event_id=source_event_id,
            expires_at=expires_at,
            metadata_json=metadata,
        )

        self.db_session.add(model)

        # flush 把 INSERT 发送给数据库，refresh 读取数据库生成字段。
        await self.db_session.flush()
        await self.db_session.refresh(model)

        return model.to_entity()

    async def get(self, memory_id: UUID) -> AgentMemory | None:
        stmt = (
            select(AgentMemoryModel)
            .where(AgentMemoryModel.id == memory_id)
            .where(AgentMemoryModel.deleted_at.is_(None))
        )

        result = await self.db_session.execute(stmt)
        model: AgentMemoryModel | None = result.scalar_one_or_none()

        return model.to_entity() if model else None

    async def list_active(
            self,
            *,
            kind: MemoryKind | None = None,
            enabled_only: bool = False,
            limit: int = 100,
    ) -> list[AgentMemory]:
        # 1. 默认只查未删除记忆。

        stmt = (select(AgentMemoryModel).where(AgentMemoryModel.deleted_at.is_(None)))

        # 按类型和启用状态过滤，给前端管理面板和第41章检索复用。
        if kind is not None:
            stmt = stmt.where(AgentMemoryModel.kind == kind.value)

        if enabled_only:
            stmt = stmt.where(AgentMemoryModel.enabled.is_(True))

        # 重要度高、更新时间新的记忆优先展示。

        stmt = stmt.order_by(
            AgentMemoryModel.importance.desc(),
            AgentMemoryModel.updated_at.desc(),
        ).limit(limit)

        result = await self.db_session.execute(stmt)

        return [model.to_entity() for model in result.scalars()]

    async def list_retrievable(
            self,
            *,
            now: datetime,
            limit: int
    ) -> list[AgentMemory]:
        stmt = (
            select(AgentMemoryModel)
            .where(
                AgentMemoryModel.enabled.is_(True),
                AgentMemoryModel.deleted_at.is_(None),
                # or_ 只要一个成立就学
                or_(
                    AgentMemoryModel.expires_at.is_(None),
                    AgentMemoryModel.expires_at > now,
                )
            )
            .order_by(
                AgentMemoryModel.importance.desc(),
                AgentMemoryModel.updated_at.desc(),
            )
            .limit(limit)
        )

        result = await self.db_session.execute(stmt)

        return [model.to_entity() for model in result.scalars()]

    async def update(
            self,
            memory_id: UUID,
            *,
            content: str | None = None,
            importance: int | None = None,
            enabled: bool | None = None,
            expires_at: datetime | None = None,
            metadata: dict[str, object] | None = None,
    ) -> AgentMemory | None:

        stmt = (
            select(AgentMemoryModel)
            .where(AgentMemoryModel.id == memory_id)
            .where(AgentMemoryModel.deleted_at.is_(None))
        )
        result = await self.db_session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None

        # 只更新调用方明确传入的字段，避免 PATCH 请求误清空数据。

        if content is not None:
            model.content = content
        if importance is not None:
            model.importance = importance
        if enabled is not None:
            model.enabled = enabled
        if expires_at is not None:
            model.expires_at = expires_at
        if metadata is not None:
            model.metadata_json = metadata

        # 手动更新时间，方便排序和前端判断最近改动。
        model.updated_at = datetime.now(UTC)

        await self.db_session.flush()
        await self.db_session.refresh(model)
        return model.to_entity()

    async def soft_delete(self, memory_id: UUID | None) -> AgentMemory | None:

        stmt = (
            select(AgentMemoryModel)
            .where(AgentMemoryModel.id == memory_id)
            .where(AgentMemoryModel.deleted_at.is_(None))
        )
        result = await self.db_session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        model.deleted_at = datetime.now(UTC)
        model.updated_at = datetime.now(UTC)
        await self.db_session.flush()
        await self.db_session.refresh(model)
        return model.to_entity()
