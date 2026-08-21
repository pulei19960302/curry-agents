from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sessions.entities import Session, SessionStatus
from app.domain.sessions.repositories import SessionRepository
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


    @staticmethod
    def _active_stmt() -> Select[tuple[SessionModel]]:
        return select(SessionModel).where(SessionModel.deleted_at.is_(None))
