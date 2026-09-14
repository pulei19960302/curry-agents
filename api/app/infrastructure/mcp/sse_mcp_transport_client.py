from typing import Any

from app.core.exceptions import AppException
from app.infrastructure.mcp.streamable_http_mcp_transport_client import StreamableHttpMcpTransportClient


class SseMcpTransportClient(StreamableHttpMcpTransportClient):
    """SSE MCP 配置占位。

    早期 MCP SSE 传输需要先建立事件流，再通过服务端返回的消息端点发送
    JSON-RPC 请求。第 32 章先识别该配置并返回清晰错误，避免假装支持完整生命周期。
    """

    def _send_json_rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        raise AppException(
            message="MCP SSE transport requires long-lived session management; use streamable_http or demo in this chapter.",
            code=501,
            status_code=501,
        )
