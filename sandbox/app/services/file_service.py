from pathlib import Path
from shutil import rmtree

from fastapi import UploadFile

from app.core.config import Settings
from app.core.exceptions import SandboxException
from app.schemas.files import (
    FileDeleteResponse,
    FileEntryResponse,
    FileListResponse,
    FileReadResponse,
    FileReplaceResponse,
    FileUploadResponse,
    FileWriteResponse,
)


class SandboxFileService:
    """在沙箱工作目录中提供受限的文件操作。

    所有由接口传入的路径都必须是相对于 ``workspace`` 的路径，并统一经过
    :meth:`_resolve_path` 解析和边界检查。这样可以阻止绝对路径以及通过
    ``..`` 越过工作目录的路径，避免接口读写宿主机上的任意文件。

    本服务只负责文件系统操作，不负责数据库事务，也不实现回收站、版本管理
    或操作回滚。写入、覆盖和删除一旦成功，就会立即反映到文件系统中。
    """

    def __init__(self, settings: Settings):
        """初始化文件服务并确保工作目录存在。

        Args:
            settings: 沙箱配置，提供工作目录以及读取、写入和上传的大小上限。

        ``resolve()`` 会把配置中的相对路径转换为绝对路径，并规范化 ``.``、
        ``..`` 等路径片段。后续所有安全边界判断都以这个规范化路径为基准。
        """
        self.settings = settings
        self.workspace = Path(settings.workspace_dir).resolve()

        # ``parents=True`` 会递归创建缺失的父目录；目录已存在时不报错。
        self.workspace.mkdir(parents=True, exist_ok=True)

    def list_files(self, path: str = ".") -> FileListResponse:
        """列出工作目录中指定目录的直接子项。

        Args:
            path: 相对于工作目录的目录路径；``.`` 表示工作目录根目录。

        Returns:
            当前目录的规范化相对路径，以及该目录下的文件和子目录列表。
            本方法只列出一层内容，不会递归遍历子目录。

        Raises:
            SandboxException: 路径越界、路径不存在，或者目标不是目录时抛出。
        """
        # 路径先通过统一入口解析，确保后续操作不会逃逸出 workspace。
        target = self._resolve_path(path)
        if not target.exists():
            raise SandboxException(message="path not found", code=404, status_code=404)
        if not target.is_dir():
            raise SandboxException(message="path is not a directory")

        # sorted() 按 Path 的自然顺序排序，使相同目录的返回顺序保持稳定。
        items = [self._to_entry(child) for child in sorted(target.iterdir())]
        return FileListResponse(current_path=self._to_relative_path(target), items=items)

    def read_file(self, path: str) -> FileReadResponse:
        """读取文件的 UTF-8 文本预览。

        Args:
            path: 相对于工作目录的文件路径。

        Returns:
            文件路径、文本预览、文件真实字节数和是否发生截断。

        Raises:
            SandboxException: 路径越界、文件不存在，或者目标不是普通文件时抛出。

        注意：当前实现会先把整个文件读入内存，再按 ``max_file_read_bytes``
        截取返回内容。因此该配置限制的是响应内容大小，并不限制读取时的内存
        占用。截断点按字节计算，若恰好切在多字节 UTF-8 字符中间，该字符会
        因 ``errors=\"replace\"`` 被替换为 ``�``，而不会抛出解码异常。
        """
        target = self._resolve_existing_file(path)

        # 使用二进制读取，方便准确按照字节数执行读取上限。
        raw_content = target.read_bytes()
        truncated = len(raw_content) > self.settings.max_file_read_bytes

        # 只向调用方返回配置上限以内的前缀；这里限制的是字节，不是字符数。
        preview = raw_content[: self.settings.max_file_read_bytes]
        content = preview.decode("utf-8", errors="replace")

        return FileReadResponse(
            content=content,
            truncated=truncated,
            path=self._to_relative_path(target),
            # size 始终表示原文件总字节数，即使 content 已被截断。
            size=len(raw_content),
        )

    def write_file(
        self,
        path: str,
        content: str,
        create_parent: bool,
    ) -> FileWriteResponse:
        """把文本以 UTF-8 编码写入工作目录中的文件。

        Args:
            path: 相对于工作目录的目标文件路径。
            content: 要写入的完整文本内容。
            create_parent: 父目录不存在时是否自动递归创建。

        Returns:
            规范化后的相对路径和实际写入的 UTF-8 字节数。

        Raises:
            SandboxException: 内容超过写入上限、路径越界、目标是目录，或者
                ``create_parent=False`` 且父目录不存在时抛出。

        本方法是“整文件写入”：目标文件已存在时会被覆盖，并且当前没有采用
        临时文件替换等原子写入方案。写入过程中若发生系统异常，旧文件可能已
        被部分修改。
        """
        # 大小限制按照编码后的字节数计算，而不是 Python 字符串的字符数。
        encoded = content.encode("utf-8")
        if len(encoded) > self.settings.max_file_write_bytes:
            raise SandboxException(message="file content is too large", code=413, status_code=413)

        target = self._resolve_path(path)

        # 防止 write_bytes() 被用于覆盖一个已有目录。
        if target.exists() and target.is_dir():
            raise SandboxException(message="path is a directory")

        if create_parent:
            # 允许调用方一次性创建多级目录。
            target.parent.mkdir(parents=True, exist_ok=True)
        elif not target.parent.exists():
            raise SandboxException(message="parent directory not found", code=404, status_code=404)

        # write_bytes() 会创建新文件；文件已存在时会清空后重新写入。
        target.write_bytes(encoded)
        return FileWriteResponse(path=self._to_relative_path(target), size=len(encoded))

    def replace_text(
        self,
        path: str,
        old_text: str,
        new_text: str,
    ) -> FileReplaceResponse:
        """替换文件中所有与 ``old_text`` 完全匹配的文本。

        Args:
            path: 相对于工作目录的文件路径。
            old_text: 要查找的文本。
            new_text: 用于替换的文本。

        Returns:
            文件路径、匹配次数以及替换后的完整文本。

        Raises:
            SandboxException: 读取或重新写入文件失败时抛出。

        替换基于 :meth:`read_file` 返回的 ``content``。因此，当源文件超过
        ``max_file_read_bytes`` 时，当前实现只会替换已读取的前缀，再用该
        前缀覆盖原文件，导致未读取的尾部丢失。接口请求模型目前要求
        ``old_text`` 至少包含一个字符，从正常 HTTP 调用进入时不会传入空串。
        """
        # 复用 read_file，统一执行路径校验、UTF-8 解码和读取上限处理。
        current = self.read_file(path)

        # count() 先记录替换前的命中数；replace() 默认替换全部匹配项。
        replacements = current.content.count(old_text)
        next_content = current.content.replace(old_text, new_text)

        # 文件已经存在，因此不允许也不需要在这里创建父目录。
        self.write_file(path=path, content=next_content, create_parent=False)
        return FileReplaceResponse(
            path=current.path,
            replacements=replacements,
            content=next_content,
        )

    def delete_path(self, path: str) -> FileDeleteResponse:
        """删除工作目录内的文件或目录。

        Args:
            path: 相对于工作目录的待删除路径。

        Returns:
            原始请求路径以及固定为 ``True`` 的删除结果。

        Raises:
            SandboxException: 路径越界、目标不存在，或尝试删除工作目录根目录
                时抛出。

        目录通过 ``rmtree`` 递归删除，其中的所有内容都会一并移除。本服务
        不提供回收站或回滚能力，因此该操作不可恢复。
        """
        target = self._resolve_path(path)

        # 即便调用方传入 "."、空白或等价路径，也不允许删除 workspace 本身。
        if target == self.workspace:
            raise SandboxException(message="workspace root cannot be deleted")
        if not target.exists():
            raise SandboxException(message="path not found", code=404, status_code=404)

        if target.is_dir():
            # 目录使用递归删除，普通文件使用 unlink 删除。由于 _resolve_path
            # 会解析符号链接，传入符号链接路径时实际操作的是其最终目标；只有
            # 目标仍在 workspace 内才允许继续。
            rmtree(target)
        else:
            target.unlink()
        return FileDeleteResponse(path=path, deleted=True)

    async def save_upload(
        self,
        directory: str,
        upload: UploadFile,
    ) -> FileUploadResponse:
        """将 FastAPI 接收到的上传文件保存到工作目录。

        Args:
            directory: 相对于工作目录的保存目录；不存在时会自动创建。
            upload: FastAPI 提供的上传文件对象。

        Returns:
            保存后的相对路径、清理后的文件名和文件字节数。

        Raises:
            SandboxException: 文件名为空、目录路径越界、目标不是目录，或者
                上传内容超过 ``max_upload_size`` 时抛出。

        当前实现通过 ``await upload.read()`` 一次性把上传内容读入内存，然后
        才检查大小。目标目录也会在读取和大小校验前创建。若同名文件已存在，
        ``write_bytes`` 会直接覆盖它；这些文件系统变化不受数据库事务控制。
        """
        # 只保留文件名最后一段。例如 "a/b.txt" 会被清理为 "b.txt"，避免
        # 客户端通过上传文件名指定任意子目录。
        filename = Path(upload.filename or "").name
        if not filename:
            raise SandboxException(message="filename is required")

        # 上传目录本身也必须经过 workspace 边界检查。
        target_dir = self._resolve_path(directory)
        target_dir.mkdir(parents=True, exist_ok=True)
        if not target_dir.is_dir():
            raise SandboxException(message="upload target is not a directory")

        # UploadFile.read() 是异步接口，但这里不分块读取，内容会全部进入内存。
        content = await upload.read()
        if len(content) > self.settings.max_upload_size:
            raise SandboxException(message="upload file is too large", code=413, status_code=413)

        # 将目录和清理后的文件名重新交给 _resolve_path，做最终边界校验。
        target = self._resolve_path(str(Path(directory) / filename))
        target.write_bytes(content)
        return FileUploadResponse(
            path=self._to_relative_path(target),
            original_name=filename,
            size=len(content),
        )

    def get_download_path(self, path: str) -> Path:
        """返回一个经过安全校验且确实存在的可下载文件路径。

        路由层可以把返回的绝对 :class:`Path` 交给 ``FileResponse``。目录、
        不存在的文件和 workspace 外部路径都会在返回前被拒绝。
        """
        return self._resolve_existing_file(path)

    def _resolve_path(self, path: str) -> Path:
        """将用户路径转换为 workspace 内的规范化绝对路径。

        空字符串和纯空白字符串按 ``.`` 处理。绝对路径会被直接拒绝；相对路径
        与 workspace 拼接并执行 ``resolve()`` 后，还会检查结果是否仍位于
        workspace 内。该检查同时阻止 ``../`` 路径穿越，以及解析后指向目录
        外部的符号链接。

        该方法只负责路径解析和边界校验，不要求目标已经存在。
        """
        # 去除首尾空白；没有有效内容时代表 workspace 根目录。
        clean_path = path.strip() or "."

        # 服务的公开接口只接受相对于 workspace 的路径。
        if Path(clean_path).is_absolute():
            raise SandboxException(message="absolute path is not allowed")

        # resolve() 会规范化 "."、".."，并解析能够解析的符号链接。
        target = (self.workspace / clean_path).resolve()

        # workspace 本身合法；其他目标必须以 workspace 为某一级父目录。
        if target != self.workspace and self.workspace not in target.parents:
            raise SandboxException(message="path escapes workspace")
        return target

    def _resolve_existing_file(self, path: str) -> Path:
        """解析路径，并保证目标是一个已存在的普通文件。

        读取和下载入口复用该方法，从而获得一致的路径安全、404 和文件类型
        校验行为。
        """
        target = self._resolve_path(path)
        if not target.exists():
            raise SandboxException(message="file not found", code=404, status_code=404)
        if not target.is_file():
            raise SandboxException(message="path is not a file")
        return target

    def _to_entry(self, path: Path) -> FileEntryResponse:
        """把一个目录项转换成文件列表接口使用的响应对象。

        文件大小来自 ``stat().st_size``；目录大小对调用方没有稳定含义，因此
        固定返回 0。``modified_at`` 是文件系统提供的 Unix 时间戳（秒）。
        """
        stat = path.stat()
        return FileEntryResponse(
            name=path.name,
            path=self._to_relative_path(path),
            type="directory" if path.is_dir() else "file",
            size=0 if path.is_dir() else stat.st_size,
            modified_at=stat.st_mtime,
        )

    def _to_relative_path(self, path: Path) -> str:
        """把绝对路径转换为稳定、跨平台的 workspace 相对路径。

        workspace 根目录统一表示为 ``.``；其他路径使用 POSIX 风格的 ``/``
        分隔符，避免把操作系统相关的路径格式暴露给 API 调用方。
        """
        relative = path.resolve().relative_to(self.workspace)
        return "." if str(relative) == "." else relative.as_posix()
