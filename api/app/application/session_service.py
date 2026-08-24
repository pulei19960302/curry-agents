from uuid import UUID

from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException

from app.domain.sessions.entities import Session, SessionMessage, SessionEvent, SessionEventType, SessionStatus


class SessionService:

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow


    async def get_session(self, session_id: UUID) -> Session:
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(message="session not found", code=404, status_code=404)
        return session


    # 创建session
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
        deleted = await self.uow.sessions.soft_delete(session_id)
        if not deleted:
            raise AppException(message="session not found", code=404, status_code=404)

        await self.uow.commit()



    # 创建用户消息和event
    async def create_user_message(self, session_id: UUID, content: str) -> tuple[SessionMessage, SessionEvent]:
        clean_content = content.strip()
        if not clean_content:
            raise AppException(message="message content is required", code=400, status_code=400)

        touched = await self.uow.sessions.touch(session_id)
        if not touched:
            raise AppException(message="session not found", code=404, status_code=404)

        message = await self.uow.session_messages.add_user_message(
            session_id = session_id,
            content = clean_content
        )

        event = await self.uow.session_event.add(
            session_id = session_id,
            event_type=SessionEventType.message_created,
            payload= {
                "message_id": str(message.id),
                "role": message.role.value,
                "content": message.content,
            }
        )

        # 增加未读消息
        await self.uow.sessions.increment_unread(session_id)
        # 更新最后更新时间
        await self.uow.sessions.touch(session_id)
        # 提交事务
        await self.uow.commit()
        return message, event


    # update_status
    async def mark_running(self, session_id: UUID) -> Session:
        await self.get_session(session_id)
        session = await self.uow.sessions.update_status(
            session_id = session_id,
            status = SessionStatus.running)

        await self.uow.commit()

        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )
        return session

    async def mark_idle(self, session_id: UUID) -> Session:
        await self.get_session(session_id)
        session = await self.uow.sessions.update_status(
            session_id=session_id,
            status=SessionStatus.idle
        )
        await self.uow.commit()
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )
        return session

    async def stop_session(self, session_id: UUID) -> Session:
        await self.get_session(session_id)
        session = await self.uow.sessions.update_status(
            session_id=session_id,
            status=SessionStatus.stopped
        )
        await self.uow.commit()
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )
        return session

    async def clear_unread(self, session_id: UUID) -> Session:
        await self.get_session(session_id)
        session = await self.uow.sessions.clear_unread(session_id)
        await self.uow.commit()
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )
        return session




    # 根据session id查询message list集合
    async def list_messages(self, session_id: UUID) -> list[SessionMessage]:
        return await self.uow.session_messages.list_by_session(session_id)


    # 根据session id 查询event list 集合
    async def list_events(self, session_id: UUID) -> list[SessionEvent]:
        return await self.uow.session_event.list_by_session(session_id)


