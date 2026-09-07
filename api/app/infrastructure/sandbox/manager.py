import httpx
from dataclasses import dataclass
from time import sleep

from app.core.config import Settings
from app.infrastructure.sandbox.file_client import SandboxFileClient
from app.infrastructure.sandbox.shell_client import SandboxShellClient


@dataclass(slots=True)
class SandboxInstance:
    """主 API 视角下的当前 DockerSandbox 实例。"""
    id: str
    name: str
    base_url: str
    status: str
    message: str


class DockerSandboxManager:
    """管理当前 Compose 沙箱容器，并提供健康检查。"""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.file_client = SandboxFileClient(
            base_url=settings.sandbox_api_base_url,
            timeout_seconds=settings.sandbox_api_timeout_seconds
        )

        self.shell_client = SandboxShellClient(
            base_url=settings.sandbox_api_base_url,
            timeout_seconds=settings.sandbox_api_timeout_seconds
        )

    # 获取或创建当前沙箱实例
    def ensure_current(self) -> SandboxInstance:
        if self._is_healthy():
            return self._build_instance("ready", "Sandbox 服务已经可用。")
        return self._build_instance("unavailable", "Sandbox 服务暂时不可用。")

    # 等待沙箱健康
    def wait_until_ready(
            self,
            retries: int | None = None,
            interval_seconds: float | None = None
    ) -> SandboxInstance:
        max_retries = retries or self.settings.docker_sandbox_wait_retries
        interval = interval_seconds or self.settings.docker_sandbox_wait_interval_seconds
        for _ in range(max_retries):
            if self._is_healthy():
                return self._build_instance("ready", "Sandbox 服务已经通过健康检查。")
            sleep(interval)

        return self._build_instance("unavailable", "等待 Sandbox 健康检查超时。")

    # 释放当前沙箱引用
    def release_current(self) -> SandboxInstance:
        return self._build_instance(
            "released",
            "当前阶段沙箱由 Docker Compose 管理，主 API 只释放引用，不停止容器。",
        )

    # 代理文件和 Shell 能力
    def read_file(self, path: str) -> dict:
        return self.file_client.read_file(path)

    def write_file(self, path: str, content: str, create_parent: bool) -> dict:
        return self.file_client.write_file(path, content, create_parent)

    def run_shell(
            self,
            command: str,
            cwd: str,
            timeout_seconds: float | None,
    ) -> dict:
        started = self.shell_client.execute(command=command, cwd=cwd)
        return self.shell_client.wait(
            session_id=str(started["id"]),
            timeout_seconds=timeout_seconds or self.settings.sandbox_shell_wait_timeout_seconds,
        )

    # 健康检查辅助方法
    def _is_healthy(self) -> bool:

        try:
            with httpx.Client(timeout=self.settings.sandbox_api_timeout_seconds) as client:
                response = client.get(f"{self.settings.sandbox_api_base_url}/status")
            payload = response.json()

        except (httpx.HTTPError, ValueError):
            return False

        return response.status_code == 200 and payload.get("code") == 200

    def _build_instance(self, status: str, message: str) -> SandboxInstance:
        return SandboxInstance(
            id=self.settings.docker_sandbox_id,
            name=self.settings.docker_sandbox_name,
            base_url=self.settings.sandbox_api_base_url,
            status=status,
            message=message,
        )
