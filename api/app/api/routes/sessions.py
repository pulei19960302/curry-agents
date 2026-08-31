from asyncio import sleep
from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, Depends, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.files import to_file_response
from app.api.sse import encode_sse
from app.application.file_service import FileService
from app.application.llm_service import LLMService
from app.application.planner_service import PlannerService
from app.application.session_service import SessionService
from app.application.unit_of_work import UnitOfWork
from app.domain.files.entities import SessionFile
from app.domain.sessions.entities import Session, SessionMessage, SessionEvent
from app.infrastructure.database.session import get_db_session
from app.schemas.common import ApiResponse
from app.schemas.files import SessionFileResponse, SessionFileListResponse
from app.schemas.session import (
    SessionResponse, SessionCreateRequest, SessionListResponse, MessageCreateRequest,
    MessageCreateResponse, MessageResponse, SessionEventResponse, MessageListResponse, SessionEventListResponse,
    PlanCreateRequest, PlanCreateResponse)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# 创建session 服务
def build_session_service(
        db_session: AsyncSession = Depends(get_db_session),
) -> SessionService:
    return SessionService(UnitOfWork(db_session))


# 创建planner 的服务
def build_planner_service(
        db_session: AsyncSession = Depends(get_db_session),
) -> PlannerService:
    return PlannerService(UnitOfWork(db_session), LLMService())


# 创建file服务
def build_file_service(
        db_session: AsyncSession = Depends(get_db_session),
) -> FileService:
    return FileService(UnitOfWork(db_session))


# entity -> session response 映射
def to_session_response(session: Session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        title=session.title,
        status=session.status.value,
        unread_count=session.unread_count,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def to_message_response(message: SessionMessage) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        session_id=message.session_id,
        role=message.role.value,
        content=message.content,
        created_at=message.created_at
    )


def to_event_response(event: SessionEvent) -> SessionEventResponse:
    return SessionEventResponse(
        id=event.id,
        session_id=event.session_id,
        type=event.type.value,
        payload=event.payload,
        created_at=event.created_at,
    )


def to_session_file_response(session_file: SessionFile) -> SessionFileResponse:
    return SessionFileResponse(
        id=session_file.id,
        session_id=session_file.session_id,
        file=to_file_response(session_file.file),
        created_at=session_file.created_at
    )


# 创建session
@router.post("", response_model=ApiResponse[SessionResponse])
async def create_session(
        payload: SessionCreateRequest,
        service: SessionService = Depends(build_session_service),
) -> ApiResponse[SessionResponse]:
    session = await service.create_session(payload.title)
    return ApiResponse(
        data=to_session_response(session)
    )


@router.get("", response_model=ApiResponse[SessionListResponse])
async def list_sessions(
        service: SessionService = Depends(build_session_service),
) -> ApiResponse[SessionListResponse]:
    sessions = await service.list_sessions()

    return ApiResponse(
        data=SessionListResponse(
            items=[to_session_response(session) for session in sessions],
        )
    )


@router.delete("/{session_id}", status_code=HTTPStatus.NO_CONTENT.value)
async def delete_session(
        session_id: UUID,
        service: SessionService = Depends(build_session_service),
) -> Response:
    await service.delete_session(session_id)
    return Response(status_code=HTTPStatus.NO_CONTENT.value)


@router.post("/{session_id}/messages", response_model=ApiResponse[MessageCreateResponse])
async def create_message(
        session_id: UUID,
        payload: MessageCreateRequest,
        service: SessionService = Depends(build_session_service),
) -> ApiResponse[MessageCreateResponse]:
    message, event = await service.create_user_message(session_id=session_id, content=payload.content)

    return ApiResponse(
        data=MessageCreateResponse(
            message=to_message_response(message),
            event=to_event_response(event)
        )
    )


@router.get("/{session_id}/messages", response_model=ApiResponse[MessageListResponse])
async def list_message(
        session_id: UUID,
        service: SessionService = Depends(build_session_service)
) -> ApiResponse[MessageListResponse]:
    result = await service.list_messages(session_id)

    return ApiResponse(
        data=MessageListResponse(
            items=[to_message_response(message) for message in result],
        )
    )


@router.get("/{session_id}/events", response_model=ApiResponse[SessionEventListResponse])
async def list_events(
        session_id: UUID,
        service: SessionService = Depends(build_session_service)
) -> ApiResponse[SessionEventListResponse]:
    result = await service.list_events(session_id)
    return ApiResponse(
        data=SessionEventListResponse(
            items=[to_event_response(event) for event in result]
        )
    )


# /{session_id}/message 的流式接口
@router.post("/{session_id}/messages/stream", response_class=StreamingResponse)
async def stream_create_message(
        session_id: UUID,
        payload: MessageCreateRequest,
        service: SessionService = Depends(build_session_service)
) -> StreamingResponse:
    # 变成运行状态
    running_session = await service.mark_running(session_id)

    # 创建用户消息
    message, event = await service.create_user_message(
        session_id=session_id,
        content=payload.content,
    )

    # 变成闲置状态
    idle_session = await service.mark_idle(session_id)

    # 模型转换
    running_data = to_session_response(running_session).model_dump(mode="json")
    message_data = to_message_response(message).model_dump(mode="json")
    event_data = to_event_response(event).model_dump(mode="json")
    idle_data = to_session_response(idle_session).model_dump(mode="json")

    async def event_stream():
        yield encode_sse("session_status", running_data)
        await sleep(0.2)
        yield encode_sse("message_created", event_data)
        await sleep(0.2)
        yield encode_sse("session_status", idle_data)
        await sleep(0.2)
        yield encode_sse(
            "stream_done",
            {
                "session_id": str(session_id),
                "message": message_data,
            },
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{session_id}/stop", response_model=ApiResponse[SessionResponse])
async def stop_session(
        session_id: UUID,
        service: SessionService = Depends(build_session_service),
) -> ApiResponse[SessionResponse]:
    session = await service.stop_session(session_id)
    return ApiResponse(data=to_session_response(session))


# 未读数量变成0
@router.post("/{session_id}/read", response_model=ApiResponse[SessionResponse])
async def clear_unread(
        session_id: UUID,
        service: SessionService = Depends(build_session_service),
) -> ApiResponse[SessionResponse]:
    session = await service.clear_unread(session_id)
    return ApiResponse(data=to_session_response(session))


# 会话上传文件
@router.post("/{session_id}/upload_file", response_model=ApiResponse[SessionFileResponse])
async def upload_session_file(
        session_id: UUID,
        upload: UploadFile = File(...),
        service: FileService = Depends(build_file_service),
) -> ApiResponse[SessionFileResponse]:
    content = await upload.read()

    session_file = await service.save_session_upload(
        session_id=session_id,
        original_name=upload.filename or "",
        content=content,
        content_type=upload.content_type,
    )

    return ApiResponse(data=to_session_file_response(session_file))


@router.get(
    "/{session_id}/files",
    response_model=ApiResponse[SessionFileListResponse],
)
async def list_session_files(
        session_id: UUID,
        service: FileService = Depends(build_file_service),
) -> ApiResponse[SessionFileListResponse]:
    files = await service.list_session_files(session_id)
    return ApiResponse(
        data=SessionFileListResponse(
            items=[to_session_file_response(file) for file in files],
        )
    )


@router.post("/{session_id}/plan", response_model=ApiResponse[PlanCreateResponse], )
async def create_plan(
        session_id: UUID,
        payload: PlanCreateRequest,
        service: PlannerService = Depends(build_planner_service),
) -> ApiResponse[PlanCreateResponse]:
    plan, event = await service.create_plan(
        session_id=session_id,
        task=payload.task,
    )

    return ApiResponse(
        data=PlanCreateResponse.model_validate({
            "plan": plan,
            "event": to_event_response(event),
        })
    )
