from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sessions.entities import (Session, SessionStatus,
                                          SessionMessage, MessageRole,
                                          SessionEvent, SessionEventType)
from app.domain.sessions.repositories import SessionRepository, SessionMessageRepository, SessionEventRepository
from app.infrastructure.database.models import SessionMessageModel, SessionEventModel
from app.infrastructure.database.models.session import SessionModel


class SqlAlchemySessionRepository(SessionRepository):

    def __init__(self, db_session: AsyncSession) -> None:
        self.session = db_session


    # 新增session 会话
    async def add(self, title:str) -> Session:
        model = SessionModel(
            title = title,
            status=SessionStatus.idle.value,
            unread_count= 0
        )
        self.session.add(model)
        # flush() 会把新增对象发送到数据库，但不提交事务。
        await self.session.flush()
        await self.session.refresh(model)

        return model.to_entity()



    # 根据session id 查询
    async def get(self, session_id: UUID) -> Session | None:
        stmt = self._active_stmt().where(SessionModel.id == session_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        return model.to_entity() if model else None

    # 获取所有的session
    async def list_active(self) -> list[Session]:
        stmt = self._active_stmt().order_by(SessionModel.updated_at.desc())
        result = await self.session.execute(stmt)
        return [model.to_entity() for model in result.scalars()]

    # 根据id 删除某一个
    async def soft_delete(self, session_id: UUID) -> None :
        stmt = self._active_stmt().where(SessionModel.id == session_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None:
            model.deleted_at = datetime.now(UTC)


    # 根据id更新
    async def touch(self, session_id: UUID) -> None:
        stmt = self._active_stmt().where(SessionModel.id == session_id)
        result = await self.session.execute(stmt)
        model = result.scalar_one_or_none()
        if model is not None:
            model.updated_at = datetime.now(UTC)


    @staticmethod
    def _active_stmt() -> Select[tuple[SessionModel]]:
        return select(SessionModel).where(SessionModel.deleted_at.is_(None))



# session message 相关的service
class SqlAlchemySessionMessageRepository(SessionMessageRepository):
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session



    async def add_user_message(self, session_id: UUID, content: str) -> SessionMessage:
        model = SessionMessageModel(
            session_id = session_id,
            content = content,
            role=MessageRole.user.value
        )

        self.db_session.add(model)
        await self.db_session.flush()
        await self.db_session.refresh(model)
        return model.to_entity()

    async def list_by_session(self, session_id: UUID) -> list[SessionMessage]:
        stmt = (select(SessionMessageModel)
                .where(SessionMessageModel.session_id == session_id)
                .order_by(SessionMessageModel.created_at.asc())
            )

        result = await self.db_session.execute(stmt)
        return [model.to_entity() for model in result.scalars()]



# session evnet 相关的service
class SqlAlchemySessionEventRepository(SessionEventRepository):

    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session


    async def add(self,session_id: UUID,event_type: SessionEventType,payload: dict) -> SessionEvent:
        model = SessionEventModel(
            session_id=session_id,
            type=event_type.value,
            payload=payload,
        )
        self.db_session.add(model)
        await self.db_session.flush()
        await self.db_session.refresh(model)
        return model.to_entity()


    async def list_by_session(self, session_id: UUID) -> list[SessionEvent]:
        stmt = (select(SessionEventModel)
                .where(SessionEventModel.session_id == session_id)
                .order_by(SessionEventModel.created_at.asc())
                )

        result = await self.db_session.execute(stmt)

        return  [model.to_entity() for model in result.scalars()]