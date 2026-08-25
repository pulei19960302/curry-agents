from pathlib import Path
from uuid import uuid4, UUID

from app.application.unit_of_work import UnitOfWork
from app.core.config import settings
from app.core.exceptions import AppException
from app.domain.files.entities import FileObject


class FileService:

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow
        self.upload_root = Path(settings.upload_dir)


    async def save_upload(
        self,
        original_name: str,
        content_type: str | None,
        content: bytes
    ) -> FileObject:
        clean_name = self._clean_filename(original_name)
        if not clean_name:
            raise AppException(
                message="files name is required",
                code=400,
                status_code=400,
            )
        if not content:
            raise AppException(
                message="files content is required",
                code=400,
                status_code=400,
            )

        if len(content) > settings.upload_max_size:
            raise AppException(
                message="files is too large",
                code=413,
                status_code=413,
            )

        stored_name = self._build_stored_name(clean_name)
        storage_path = self.upload_root / stored_name
        self.upload_root.mkdir(parents=True, exist_ok=True)
        storage_path.write_bytes(content)

        try:
            file_object = await self.uow.files.add(
                original_name=original_name,
                storage_path=str(storage_path),
                stored_name=stored_name,
                content_type=content_type or "application/octet-stream",
                size=len(content),
            )
            await self.uow.commit()

        except Exception:
            # 元数据写入失败时清理已落盘文件，避免出现没有数据库记录的孤立文件。
            storage_path.unlink(missing_ok=True)
            await self.uow.rollback()
            raise

        return file_object

    async def get_file(self, file_id: UUID) -> FileObject:
        file_object = await self.uow.files.get(file_id)
        if file_object is None:
            raise AppException(
                message="files not found",
                code=404,
                status_code=404,
            )
        return file_object

    async def get_download_path(self, file_id: UUID) -> tuple[FileObject, Path]:
        file_object = await self.get_file(file_id)
        path = Path(file_object.storage_path)
        if not path.is_file():
            raise AppException(
                message="files content not found",
                code=404,
                status_code=404,
            )
        return file_object, path



    @staticmethod
    def _clean_filename(filename: str) -> str:
        # 只保留文件名本身，避免用户传入 ../ 这类路径片段。
        return Path(filename).name.strip()

    @staticmethod
    def _build_stored_name(filename: str) -> str:
        suffix = Path(filename).suffix
        return f"{uuid4().hex}{suffix}"