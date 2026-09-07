from typing import Any

from app.infrastructure.sandbox.base_client import SandboxBaseClient


class SandboxShellClient(SandboxBaseClient):
    """主 API 访问 Sandbox Shell 接口的同步客户端。"""

    # 启动 Shell 会话
    def execute(self, command: str, cwd: str = ".") -> dict[str, Any]:
        return self._request(
            path="/shell/sessions",
            method="POST",
            json={"command": command, "cwd": cwd}
        )

    # 等待 Shell 会话完成
    def wait(self, session_id: str, timeout_seconds: float | None = None) -> dict[str, Any]:
        return self._request(
            path=f"/shell/sessions/{session_id}/wait",
            method="POST",
            json={"timeout_seconds": timeout_seconds},
        )

    # 查询和控制 Shell 会话
    def get(self, session_id: str) -> dict[str, Any]:
        return self._request(method="GET", path=f"/shell/sessions/{session_id}")

    def write(self, session_id: str, value: str) -> dict[str, Any]:
        return self._request(
            method="POST",
            path=f"/shell/sessions/{session_id}/write",
            json={"input": value},
        )

    def terminate(self, session_id: str) -> dict[str, Any]:
        return self._request(method="POST", path=f"/shell/sessions/{session_id}/terminate")
