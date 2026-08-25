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