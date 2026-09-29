from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.application.memory_service import MemoryService
from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
from app.domain.memories.entities import MemoryKind
from app.infrastructure.database.session import get_db_session
from app.schemas.common import ApiResponse
from app.schemas.memory import (
    MemoryCandidateListResponse,
    MemoryCandidateResponse,
    MemoryCreateRequest,
    MemoryExtractRequest,
    MemoryListResponse,
    MemoryResponse,
    MemoryUpdateRequest,
)

router = APIRouter(prefix="/memories", tags=["memories"])


def build_memory_service(
        db_session: AsyncSession = Depends(get_db_session),
) -> MemoryService:
    return MemoryService(UnitOfWork(db_session))


def parse_memory_kind(value: str) -> MemoryKind:
    try:
        return MemoryKind(value)
    except ValueError as exc:
        raise AppException(
            message=f"unsupported memory kind: {value}",
            code=400,
            status_code=400,
        ) from exc


#  读取长期记忆列表
@router.get("", response_model=ApiResponse[MemoryListResponse])
async def list_memories(
        kind: str | None = Query(default=None),
        enabled_only: bool = Query(default=False),
        limit: int = Query(default=100, ge=1, le=500),
        service: MemoryService = Depends(build_memory_service),
) -> ApiResponse[MemoryListResponse]:
    memory_kind = parse_memory_kind(kind) if kind else None
    memories = await service.list_memories(
        kind=memory_kind,
        enabled_only=enabled_only,
        limit=limit,
    )
    return ApiResponse(
        data=MemoryListResponse(
            items=[MemoryResponse.model_validate(memory) for memory in memories]
        )
    )


#  手动新增长期记忆
@router.post("", response_model=ApiResponse[MemoryResponse])
async def create_memory(
        payload: MemoryCreateRequest,
        service: MemoryService = Depends(build_memory_service),
) -> ApiResponse[MemoryResponse]:
    memory = await service.create_memory(
        kind=parse_memory_kind(payload.kind),
        content=payload.content,
        importance=payload.importance,
        source_session_id=payload.source_session_id,
        source_event_id=payload.source_event_id,
        expires_at=payload.expires_at,
        metadata=payload.metadata,
    )
    return ApiResponse(data=MemoryResponse.model_validate(memory))


#  第3步：更新长期记忆 
@router.patch("/{memory_id}", response_model=ApiResponse[MemoryResponse])
async def update_memory(
        memory_id: UUID,
        payload: MemoryUpdateRequest,
        service: MemoryService = Depends(build_memory_service),
) -> ApiResponse[MemoryResponse]:
    memory = await service.update_memory(
        memory_id,
        content=payload.content,
        importance=payload.importance,
        enabled=payload.enabled,
        expires_at=payload.expires_at,
        metadata=payload.metadata,
    )
    return ApiResponse(data=MemoryResponse.model_validate(memory))


# 删除长期记忆
@router.delete("/{memory_id}", response_model=ApiResponse[MemoryResponse])
async def delete_memory(
        memory_id: UUID,
        service: MemoryService = Depends(build_memory_service),
) -> ApiResponse[MemoryResponse]:
    memory = await service.delete_memory(memory_id)
    return ApiResponse(data=MemoryResponse.model_validate(memory))


# 从会话抽取记忆候选
@router.post("/extract", response_model=ApiResponse[MemoryCandidateListResponse])
async def extract_memory_candidates(
        payload: MemoryExtractRequest,
        service: MemoryService = Depends(build_memory_service),
) -> ApiResponse[MemoryCandidateListResponse]:
    candidates = await service.extract_candidates(payload.session_id)
    return ApiResponse(
        data=MemoryCandidateListResponse(
            items=[
                MemoryCandidateResponse.model_validate(candidate)
                for candidate in candidates
            ]
        )
    )
