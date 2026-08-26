from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(slots=True)
class StoredFile:
    storage_name: str

    storage_path: str


class FileStorage(Protocol):

    def save(self, clean_name: str, content: bytes) -> StoredFile: ...

    def delete(self, storage_path: str) -> None: ...

    def exists(self, storage_path: str) -> bool: ...

    def read_bytes(self, storage_path: str, max_size: int | None) -> bytes: ...

    def get_local_path(self, storage_path: str) -> Path: ...
