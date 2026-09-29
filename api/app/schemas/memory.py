from datetime import datetime
from pydantic import Field
from uuid import UUID

from app.schemas.common import ResponseSchema


class MemoryCreateRequest(ResponseSchema):
    """手动创建或确认候选记忆时提交的数据。"""

    kind: str = Field(min_length=1, max_length=64)  # 长期记忆业务分类。
    content: str = Field(min_length=1, max_length=2000)  # 可进入上下文的正文。
    importance: int = Field(default=3, ge=1, le=5)  # 重要度，1 最低、5 最高。
    source_session_id: UUID | None = None  # 来源会话，手动录入时可以为空。
    source_event_id: UUID | None = None  # 来源事件，便于追溯工具或任务结果。
    expires_at: datetime | None = None  # 过期时间；为空表示长期有效。
    metadata: dict[str, object] = Field(default_factory=dict)  # 扩展来源信息。


class MemoryUpdateRequest(ResponseSchema):
    """修改记忆时允许更新的字段。未传入字段保持原值。"""

    content: str | None = Field(default=None, min_length=1, max_length=2000)
    importance: int | None = Field(default=None, ge=1, le=5)
    enabled: bool | None = None
    expires_at: datetime | None = None
    metadata: dict[str, object] | None = None


class MemoryResponse(ResponseSchema):
    """返回给前端的一条完整长期记忆。"""

    id: UUID
    kind: str
    content: str
    importance: int
    enabled: bool
    source_session_id: UUID | None
    source_event_id: UUID | None
    expires_at: datetime | None
    metadata: dict[str, object]
    created_at: datetime | None
    updated_at: datetime | None


class MemoryListResponse(ResponseSchema):
    """长期记忆列表响应。"""

    items: list[MemoryResponse]


class MemoryExtractRequest(ResponseSchema):
    session_id: UUID  # 从这个会话的消息和事件中抽取候选。


class MemoryCandidateResponse(ResponseSchema):
    """尚未写入数据库、等待用户确认的记忆候选。"""

    kind: str
    content: str
    importance: int
    reason: str
    source_session_id: UUID | None
    source_event_id: UUID | None
    metadata: dict[str, object]


class MemoryCandidateListResponse(ResponseSchema):
    """候选记忆列表响应。"""

    items: list[MemoryCandidateResponse]
