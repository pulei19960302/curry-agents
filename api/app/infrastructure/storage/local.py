from pathlib import Path
from uuid import uuid4

from app.domain.files.storage import FileStorage, StoredFile


class LocalFileStorage(FileStorage):

    def __init__(self, upload_root: str) -> None:
        self.upload_root = Path(upload_root)

    def save(self, clean_name: str, content: bytes) -> StoredFile:
        stored_name = self._build_stored_name(clean_name)
        storage_path = self.upload_root / stored_name

        # 写入文件
        # parents = True：父目录不存在时一起创建
        # exist_ok = True：目录已经存在时不报错
        self.upload_root.mkdir(parents=True, exist_ok=True)
        storage_path.write_bytes(content)

        return StoredFile(
            storage_path=str(storage_path),
            storage_name=stored_name
        )

    def delete(self, storage_path: str) -> None:
        Path(storage_path).unlink(missing_ok=True)

    def exists(self, storage_path: str) -> bool:
        return Path(storage_path).is_file()

    def read_bytes(self, storage_path: str, max_size: int | None) -> bytes:
        if max_size is None:
            return Path(storage_path).read_bytes()

        # 预览只需要读取文件开头；本地文件可以直接按字节数读取。
        with Path(storage_path).open("rb") as file:
            return file.read(max_size)

    def get_local_path(self, storage_path: str) -> Path:
        return Path(storage_path)

    @staticmethod
    def _build_stored_name(filename: str) -> str:
        suffix = Path(filename).suffix
        return f"{uuid4().hex}{suffix}"
