from pydantic import Field

from app.schemas.common import ResponseSchema


class SandboxInstanceResponse(ResponseSchema):
    id: str  # 主 API 识别当前沙箱实例的稳定 ID。
    name: str  # Docker Compose 中的沙箱容器名。
    base_url: str  # 主 API 访问 Sandbox 服务的 API 地址。
    status: str  # ready、unavailable、released 等状态。
    message: str  # 给前端展示的状态说明。


class SandboxWaitRequest(ResponseSchema):
    retries: int | None = Field(default=None, ge=1)
    interval_seconds: float | None = Field(default=None, gt=0)


class SandboxFileReadResponse(ResponseSchema):
    path: str
    content: str
    size: int
    truncated: bool


class SandboxFileWriteRequest(ResponseSchema):
    path: str = Field(min_length=1)
    content: str
    create_parent: bool = True


class SandboxFileWriteResponse(ResponseSchema):
    path: str
    size: int


class SandboxShellRunRequest(ResponseSchema):
    command: str = Field(min_length=1)
    cwd: str = "."
    timeout_seconds: float | None = None


class SandboxShellRunResponse(ResponseSchema):
    id: str
    command: str
    cwd: str
    status: str
    return_code: int | None
    output: str
    output_truncated: bool


class SandboxVncStatusResponse(ResponseSchema):
    enabled: bool  # 是否启用 VNC/noVNC 远程桌面。
    display: str  # Xvfb 虚拟显示器编号，例如 :99。
    vnc_port: int  # x11vnc 在容器内监听的原生 VNC 端口。
    web_port: int  # websockify/noVNC 在容器内监听的 Web 端口。
    iframe_path: str  # 兼容字段，保留给直接打开 noVNC 页面这类方案。
    websocket_path: str  # 前端 noVNC SDK 连接 websockify 时使用的 WebSocket 路径。
    message: str  # 给前端展示的状态说明。
