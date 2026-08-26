from pathlib import Path
from uuid import uuid4, UUID

from app.application.unit_of_work import UnitOfWork
from app.core.config import settings
from app.core.exceptions import AppException
from app.domain.files.entities import FileObject, SessionFile

TEXT_PREVIEW_TYPES = {
    "application/json",
    "application/xml",
    "application/yaml",
    "text/csv",
}


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
        stored_name = self._build_stored_name(clean_name)
        storage_path = self.upload_root / stored_name

        self.upload_root.mkdir(parents=True, exist_ok=True)
        storage_path.write_bytes(content)

        try:
            file_object = await self.uow.files.add(
                original_name=clean_name,
                stored_name=stored_name,
                content_type=content_type or "application/octet-stream",
                size=len(content),
                storage_path=str(storage_path),
            )
            session_file = await self.uow.session_files.add(
                session_id=session_id,
                file_id=file_object.id,
            )
            await self.uow.sessions.touch(session_id)
            await self.uow.commit()
        except Exception:
            # 会话归属写入失败时也要清理文件，避免页面永远找不到这份上传内容。
            storage_path.unlink(missing_ok=True)
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
        content = path.read_bytes()
        truncated = len(content) > settings.file_preview_max_size
        preview_bytes = content[: settings.file_preview_max_size]
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
    def _build_stored_name(filename: str) -> str:
        suffix = Path(filename).suffix
        return f"{uuid4().hex}{suffix}"

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
