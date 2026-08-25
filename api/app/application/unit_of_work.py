from types import TracebackType
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sessions.repositories import SessionRepository, SessionMessageRepository, SessionEventRepository
from app.infrastructure.repositories.session_repository import (
    SqlAlchemySessionRepository,
    SqlAlchemySessionEventRepository,
    SqlAlchemySessionMessageRepository
)

from app.infrastructure.repositories.file_repository import SqlAlchemyFileRepository
from app.domain.files.repositories import FileRepository

class UnitOfWork:
    """在同一个数据库会话中组织仓储操作和事务边界。"""

    def __init__(self, db_session: AsyncSession) -> None:
        self._db_session = db_session
        self.sessions: SessionRepository = SqlAlchemySessionRepository(db_session)
        self.session_messages: SessionMessageRepository = SqlAlchemySessionMessageRepository(db_session)
        self.session_event: SessionEventRepository = SqlAlchemySessionEventRepository(db_session)
        self.files: FileRepository = SqlAlchemyFileRepository(db_session)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc_value: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        # commit() 已完成的事务不会被撤销；未提交的修改会在这里回滚。
        await self.rollback()

    async def commit(self) -> None:
        await self._db_session.commit()

    async def rollback(self) -> None:
        await self._db_session.rollback()
