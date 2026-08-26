from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileResponse(BaseModel):
    id: UUID
    original_name: str
    content_type: str
    size: int
    download_url: str
    created_at: datetime


class SessionFileResponse(BaseModel):
    id: UUID
    session_id: UUID
    file: FileResponse
    created_at: datetime


class SessionFileListResponse(BaseModel):
    items: list[SessionFileResponse]


class FilePreviewResponse(BaseModel):
    file: FileResponse
    content: str
    truncated: bool
