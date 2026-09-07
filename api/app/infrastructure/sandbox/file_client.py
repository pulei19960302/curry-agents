from typing import Any

from app.infrastructure.sandbox.base_client import SandboxBaseClient


class SandboxFileClient(SandboxBaseClient):
    """主 API 访问 Sandbox 文件接口的同步客户端。"""

    def list_files(self, path: str = ".") -> dict[str, Any]:
        return self._request(path="/files", method="GET", params={"path": path})

    def read_file(self, path: str) -> dict[str, Any]:
        return self._request(path="/files/read", method="GET", params={"path": path})

    def write_file(
            self,
            path: str,
            content: str,
            create_parent: bool = True,
    ) -> dict[str, Any]:
        return self._request(
            method="POST",
            path="/files/write",
            json={
                "path": path,
                "content": content,
                "create_parent": create_parent,
            },
        )

    def replace_text(
            self,
            path: str,
            old_text: str,
            new_text: str,
    ) -> dict[str, Any]:
        return self._request(
            method="POST",
            path="/files/replace",
            json={
                "path": path,
                "old_text": old_text,
                "new_text": new_text,
            },
        )

    def delete_path(self, path: str) -> dict[str, Any]:
        return self._request(method="DELETE", path="/files", params={"path": path})
