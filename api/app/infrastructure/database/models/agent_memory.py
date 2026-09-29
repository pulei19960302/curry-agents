from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey, DateTime, text, func, Index
from sqlalchemy.dialects.postgresql import UUID as PgUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from uuid import UUID, uuid4

from app.domain.memories.entities import AgentMemory, MemoryKind
from app.infrastructure.database.base import Base


class AgentMemoryModel(Base):
    """长期记忆数据库模型。"""

    __tablename__ = "agent_memory"

    __table_args__ = (
        # 1. 复合索引：优化按种类和启用状态查询
        Index("ix_agent_memories_kind_enabled", "kind", "enabled"),

        # 2. 复合索引：优化按重要性排序或过滤，并结合更新时间查询
        Index("ix_agent_memories_importance_updated", "importance", "updated_at"),

        # 3. 单列索引：优化外键关联查询
        Index("ix_agent_memories_source_session", "source_session_id"),
    )

    # 定义记忆主体字段
    id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    kind: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    importance: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )

    # 保存记忆来源和生命周期
    source_session_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    source_event_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("session_events.id", ondelete="SET NULL"),
        nullable=True,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    metadata_json: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,  # Python 层默认值：工厂函数
        server_default=text("'{}'::jsonb"),  # 数据库层默认值
    )

    # 记录审计时间
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # ===================== 第4步：把 ORM 模型转换为领域实体 =====================
    def to_entity(self) -> AgentMemory:
        return AgentMemory(
            id=self.id,
            kind=MemoryKind(self.kind),
            content=self.content,
            importance=self.importance,
            enabled=self.enabled,
            source_session_id=self.source_session_id,
            source_event_id=self.source_event_id,
            expires_at=self.expires_at,
            metadata=dict(self.metadata_json or {}),
            created_at=self.created_at,
            updated_at=self.updated_at,
            deleted_at=self.deleted_at,
        )
