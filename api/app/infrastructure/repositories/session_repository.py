from datetime import datetime
from typing import TypedDict, Unpack
from uuid import UUID

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.domain.sessions.entities import (Session, SessionStatus,
                                          SessionMessage, MessageRole,
                                          SessionEvent, SessionEventType)
from app.domain.sessions.repositories import SessionRepository, SessionMessageRepository, SessionEventRepository
from app.infrastructure.database.models import SessionMessageModel, SessionEventModel
from app.infrastructure.database.models.session import SessionModel


class _SessionUpdateValues(TypedDict, total=False):
    status: str
    unread_count: int | ColumnElement[int]
    updated_at: datetime | ColumnElement[datetime]
    deleted_at: datetime | ColumnElement[datetime]


class SqlAlchemySessionRepository(SessionRepository):

    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session


    # 新增session 会话
    async def add(self, title:str) -> Session:
        model = SessionModel(
            title = title,
            status=SessionStatus.idle.value,
            unread_count= 0
        )
        self.db_session.add(model)
        # flush() 会把新增对象发送到数据库，但不提交事务。
        await self.db_session.flush()
        await self.db_session.refresh(model)

        return model.to_entity()



    # 根据session id 查询
    async def get(self, session_id: UUID) -> Session | None:
        stmt = self._active_stmt().where(SessionModel.id == session_id)
        result = await self.db_session.execute(stmt)
        model = result.scalar_one_or_none()
        return model.to_entity() if model else None

    # 获取所有的session
    async def list_active(self) -> list[Session]:
        stmt = self._active_stmt().order_by(SessionModel.updated_at.desc())
        result = await self.db_session.execute(stmt)
        return [model.to_entity() for model in result.scalars()]

    # 根据id 删除某一个
    async def soft_delete(self, session_id: UUID) -> bool:
        model = await self._update_active(session_id, deleted_at=func.now())
        return model is not None


    # 根据id更新
    async def touch(self, session_id: UUID) -> bool:
        model = await self._update_active(session_id, updated_at=func.now())
        return model is not None

    # 更新状态
    async def update_status(self, session_id: UUID, status: SessionStatus) -> Session | None:
        model = await self._update_active(
            session_id,
            status=status.value,
            updated_at=func.now(),
        )
        if model is None:
            return None
        return model.to_entity()

    # 原子增加未读数，避免先查询再写回造成并发更新丢失。
    async def increment_unread(self, session_id: UUID) -> bool:
        model = await self._update_active(
            session_id,
            unread_count=SessionModel.unread_count + 1,
            updated_at=func.now(),
        )
        return model is not None

    async def clear_unread(self, session_id: UUID) -> Session | None:
        model = await self._update_active(
            session_id,
            unread_count=0,
            updated_at=func.now(),
        )
        return model.to_entity() if model is not None else None


    @staticmethod
    def _active_stmt() -> Select[tuple[SessionModel]]:
        return select(SessionModel).where(SessionModel.deleted_at.is_(None))



    # SQLAlchemy 官方说明，ORM UPDATE ... RETURNING 可以直接返回更新后的 ORM 对象；
    # 在支持 RETURNING 的 PostgreSQL 上，默认 session 同步策略也会使用返回值同步对象状态
    async def _update_active(
        self,
        session_id: UUID,
        **values: Unpack[_SessionUpdateValues],
    ) -> SessionModel | None:
        stmt = (
            update(SessionModel)
            .where(
                SessionModel.id == session_id,
                SessionModel.deleted_at.is_(None),
            )
            .values(**values)
            .returning(SessionModel)
        )
        result = await self.db_session.execute(stmt)
        return result.scalar_one_or_none()



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
