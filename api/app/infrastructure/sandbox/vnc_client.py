from typing import Any

from app.infrastructure.sandbox.base_client import SandboxBaseClient


class SandboxVncClient(SandboxBaseClient):

    def status(self) -> dict[str, Any]:
        return self._request(method="GET", path="/vnc/status")
