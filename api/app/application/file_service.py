from pathlib import Path
from uuid import UUID

from app.application.unit_of_work import UnitOfWork
from app.core.config import settings
from app.core.exceptions import AppException
from app.domain.files.entities import FileObject, SessionFile
from app.domain.files.storage import FileStorage, StoredFile
from app.infrastructure.storage.factory import build_file_storage

TEXT_PREVIEW_TYPES = {
    "application/json",
    "application/xml",
    "application/yaml",
    "text/csv",
}


class FileService:

    def __init__(self, uow: UnitOfWork, storage: FileStorage | None = None) -> None:
        self.uow = uow
        # 有就用没有就用构建的
        self.storage = storage or build_file_storage()

    async def save_upload(
            self,
            original_name: str,
            content_type: str | None,
            content: bytes
    ) -> FileObject:

        clean_name = self._clean_filename(original_name)
        stored_file = self._write_upload_file(
            clean_name=clean_name,
            content=content,
        )

        try:
            file_object = await self.uow.files.add(
                original_name=clean_name,
                storage_path=stored_file.storage_path,
                stored_name=stored_file.storage_name,
                content_type=content_type or "application/octet-stream",
                size=len(content),
            )
            await self.uow.commit()

        except Exception:
            # 元数据写入失败时清理已落盘文件，避免出现没有数据库记录的孤立文件。
            self.storage.delete(stored_file.storage_path)
            await self.uow.rollback()
            raise

        return file_object

    # 获取文件
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
        # 判断文件存在不
        if not self.storage.exists(file_object.storage_path):
            raise AppException(
                message="file content not found",
                code=404,
                status_code=404,
            )
        path = self.storage.get_local_path(file_object.storage_path)
        return file_object, path

    # 上传文件并绑定会话
    async def save_session_upload(
            self,
            session_id: UUID,
            original_name: str,
            content_type: str | None,
            content: bytes
    ) -> SessionFile:
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )

        clean_name = self._clean_filename(original_name)
        stored_file = self._write_upload_file(
            clean_name=clean_name,
            content=content,
        )

        try:
            file_object = await self.uow.files.add(
                original_name=clean_name,
                stored_name=stored_file.storage_name,
                content_type=content_type or "application/octet-stream",
                size=len(content),
                storage_path=stored_file.storage_path,
            )
            session_file = await self.uow.session_files.add(
                session_id=session_id,
                file_id=file_object.id,
            )
            await self.uow.sessions.touch(session_id)
            await self.uow.commit()
        except Exception:
            # 会话归属写入失败时也要清理文件，避免页面永远找不到这份上传内容。
            self.storage.delete(stored_file.storage_path)
            await self.uow.rollback()
            raise
        return session_file

    # 预览接口
    async def preview_file(self, file_id) -> tuple[FileObject, str, bool]:
        file_object, path = await self.get_download_path(file_id)
        if not self._is_text_preview_supported(file_object):
            raise AppException(
                message="file preview is not supported",
                code=415,
                status_code=415,
            )

        # 预览只读取有限字节，避免把大文件一次性塞进接口响应。
        preview_bytes = self.storage.read_bytes(
            file_object.storage_path,
            max_size=settings.file_preview_max_size + 1,
        )
        truncated = len(preview_bytes) > settings.file_preview_max_size
        preview_bytes = preview_bytes[: settings.file_preview_max_size]

        return file_object, preview_bytes.decode("utf-8", errors="replace"), truncated

    # list session file
    async def list_session_files(self, session_id: UUID) -> list[SessionFile]:
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )
        return await self.uow.session_files.list_by_session(session_id)

    @staticmethod
    def _clean_filename(filename: str) -> str:
        # 只保留文件名本身，避免用户传入 ../ 这类路径片段。
        return Path(filename).name.strip()

    @staticmethod
    def _is_text_preview_supported(file_object: FileObject) -> bool:
        content_type = file_object.content_type.split(";")[0].lower()
        if content_type.startswith("text/") or content_type in TEXT_PREVIEW_TYPES:
            return True
        return Path(file_object.original_name).suffix.lower() in {
            ".json",
            ".md",
            ".py",
            ".txt",
            ".ts",
            ".tsx",
            ".yaml",
            ".yml",
        }

    def _write_upload_file(self, clean_name: str, content: bytes) -> StoredFile:
        if not clean_name:
            raise AppException(
                message="file name is required",
                code=400,
                status_code=400,
            )
        if not content:
            raise AppException(
                message="file content is required",
                code=400,
                status_code=400,
            )
        if len(content) > settings.upload_max_size:
            raise AppException(
                message="file is too large",
                code=413,
                status_code=413,
            )

        return self.storage.save(clean_name, content)
