from datetime import datetime
from uuid import UUID, uuid4

from anyio import EventStatistics
from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base
from app.domain.sessions.entities import SessionEvent, SessionEventType


# 会话事件 ORM 模型。
class SessionEventModel(Base):
    __tablename__ = "session_events"
    __table_args__ = (
        Index(
            "ix_session_events_session_created",
            "session_id",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    session_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def to_entity(self) -> SessionEvent:
        return SessionEvent(
            id=self.id,
            session_id=self.session_id,
            type=SessionEventType(self.type),
            payload=self.payload,
            created_at=self.created_at,
        )

