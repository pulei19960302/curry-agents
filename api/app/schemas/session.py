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