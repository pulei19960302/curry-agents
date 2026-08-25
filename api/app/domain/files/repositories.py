from typing import Protocol
from uuid import UUID

from app.domain.files.entities import FileObject


class FileRepository(Protocol):

    async def add(
        self,
        original_name: str,
        stored_name: str,
        content_type: str,
        size: int,
        storage_path: str,) -> FileObject: ...


    async def get(self, file_id: UUID) -> FileObject | None: ...