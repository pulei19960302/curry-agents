import httpx
from typing import Any

from app.core.exceptions import AppException


class SandboxFileClient:
    """主 API 访问 Sandbox 文件接口的同步客户端。"""

    def __init__(self, base_url: str, timeout_seconds: float) -> None:
        # base_url 指向 Sandbox 服务地址，例如 http://sandbox:8100/api。
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

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

        # ===================== 第5步：封装文件删除 =====================

    def delete_path(self, path: str) -> dict[str, Any]:
        return self._request(method="DELETE", path="/files", params={"path": path})

    def _request(
            self,
            path: str,
            method: str,
            **kwargs: Any
    ) -> dict[str, Any]:
        url = f"{self.base_url}{path}"

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.request(url=url, method=method, **kwargs)

        except httpx.HTTPError as error:
            raise AppException(
                message=f"sandbox request failed: {error}",
                code=502,
                status_code=502,
            ) from error

        try:
            payload = response.json()
        except ValueError as error:
            raise AppException(
                message="sandbox returned non-json response",
                code=502,
                status_code=502,
            ) from error

        if response.status_code >= 400 or payload.get("code") != 200:
            raise AppException(
                message=str(payload.get("message") or "sandbox request failed"),
                code=int(payload.get("code") or response.status_code),
                status_code=response.status_code,
            )

        data = payload.get("data")
        if not isinstance(data, dict):
            raise AppException(
                message="sandbox returned invalid data",
                code=502,
                status_code=502,
            )
        return data
