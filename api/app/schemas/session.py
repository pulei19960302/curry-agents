from datetime import datetime
from uuid import UUID


from pydantic import Field, BaseModel


# 创建session的规则
class SessionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


# session 请求返回头
class SessionResponse(BaseModel):
    id: UUID
    title: str
    status: str
    unread_count: int
    created_at: datetime
    updated_at: datetime


# list 请求
class SessionListResponse(BaseModel):
    items: list[SessionResponse]


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class MessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    created_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageResponse]


class SessionEventResponse(BaseModel):
    id: UUID
    session_id: UUID
    type: str
    payload: dict
    created_at: datetime


class SessionEventListResponse(BaseModel):
    items: list[SessionEventResponse]


class MessageCreateResponse(BaseModel):
    message: MessageResponse
    event: SessionEventResponse