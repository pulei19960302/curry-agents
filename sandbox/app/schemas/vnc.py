from app.schemas.common import ResponseSchema


class VncStatusResponse(ResponseSchema):
    enabled: bool  # 是否启用 VNC/noVNC 远程桌面。
    display: str  # Xvfb 虚拟显示器编号，例如 :99。
    vnc_port: int  # x11vnc 在容器内监听的原生 VNC 端口。
    web_port: int  # websockify/noVNC 在容器内监听的 Web 端口。
    iframe_path: str  # 兼容字段，保留给直接打开 noVNC 页面这类方案。
    websocket_path: str  # 前端 noVNC SDK 连接 websockify 时使用的 WebSocket 路径。
    message: str  # 给前端展示的状态说明。
