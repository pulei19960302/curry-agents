from datetime import datetime
from uuid import UUID

from pydantic import computed_field

from app.schemas.common import ResponseSchema


class FileResponse(ResponseSchema):
    id: UUID
    original_name: str
    content_type: str
    size: int
    created_at: datetime

    @computed_field
    @property
    def download_url(self) -> str:
        return f"/api/files/{self.id}/download"


class SessionFileResponse(ResponseSchema):
    id: UUID
    session_id: UUID
    file: FileResponse
    created_at: datetime


class SessionFileListResponse(ResponseSchema):
    items: list[SessionFileResponse]


# 引用片段响应
class FileReferenceResponse(ResponseSchema):
    label: str
    excerpt: str
    start_line: int | None = None
    end_line: int | None = None


class FilePreviewResponse(ResponseSchema):
    file: FileResponse
    content: str  # 裁剪后的原文预览
    file_type: str  # 后端识别出的文件类型，例如 markdown、code、csv、pdf
    language: str | None  # 前端展示或后续代码高亮用的语言
    line_count: int  # 当前预览内容的行数
    parse_status: str  # 解析状态，例如 parsed、unsupported、empty
    parse_message: str  # 给用户看的解析说明
    references: list[FileReferenceResponse]  # 可引用片段，包含标签、片段内容和行号
    summary: str  # 低成本结构摘要
    truncated: bool  # 预览是否因为长度限制被裁剪
