from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base
from app.infrastructure.database.models import FileObjectModel
from app.domain.files.repositories import SessionFile


class SessionFileModel(Base):
    __tablename__ = 'session_files'

    # 约束session_id 和 file_id 组合起来只能唯一
    __table_args__ = (
        UniqueConstraint("session_id", "file_id", name="uq_session_files_session_file"),
    )

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)

    session_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        # sessions 表的 id 字段，ondelete当 Session 被物理删除时，关联数据也由数据库自动删除。
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    file_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        # 和上面一样的
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # lazy="joined" 表示查询关联记录时，立即通过 JOIN 一起加载文件。
    #
    file: Mapped[FileObjectModel] = relationship(lazy="joined")


    def to_entity(self) -> SessionFile:
        return SessionFile(
            id=self.id,
            session_id=self.session_id,
            file=self.file.to_entity(),
            created_at=self.created_at,
        )
