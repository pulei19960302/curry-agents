from uuid import UUID

from pydantic import BaseModel

from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException

from app.domain.sessions.entities import Session


class SessionService:

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def create_session(self, title: str) -> Session:

        clean_title = title.strip()
        if not clean_title:
            raise AppException(message="session title is required", code=400, status_code=400)

        session = await self.uow.sessions.add(title = clean_title)
        await self.uow.commit() # 事务提交
        return session

    async def list_sessions(self) -> list[Session]:
        return await self.uow.sessions.list_active()


    async def delete_session(self, session_id: UUID) -> None:
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(message="session not found", code=404, status_code=404)

        await self.uow.sessions.soft_delete(session_id)
        await self.uow.commit()


