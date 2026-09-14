from typing import Any

from app.core.exceptions import AppException
from app.core.mcp_config import load_mcp_config, McpServerConfig
from app.domain.mcp.entities import McpServerInfo, McpTool, McpToolResult
from app.infrastructure.mcp.client import McpTransportClient
from app.infrastructure.mcp.demo_mcp_transport_client import DemoMcpTransportClient
from app.infrastructure.mcp.sse_mcp_transport_client import SseMcpTransportClient
from app.infrastructure.mcp.stdio_mcp_transport_client import StdioMcpTransportClient
from app.infrastructure.mcp.streamable_http_mcp_transport_client import StreamableHttpMcpTransportClient


class McpClientManager:
    """MCP Client 管理器。

       它读取 MCP 配置，按 server_name 创建对应传输客户端，
       并向应用服务提供统一的 list_tools / call_tool 方法。
       """

    def __init__(self):
        self.config = load_mcp_config()

    # 所有的servers
    def list_servers(self) -> list[McpServerInfo]:
        return [
            McpServerInfo(
                name=name,
                enabled=server.enabled,
                transport=server.transport,
                description=server.description,
            )
            for name, server in self.config.servers.items()
        ]

    def list_tools(self, server_name: str | None = None) -> list[McpTool]:
        if server_name:
            server_names = [server_name]
        else:
            server_names = [
                name
                for name, server in self.config.servers.items()
                if server.enabled
            ]

        tools: list[McpTool] = []

        for name in server_names:
            server = self._get_enabled_server(name)
            tools.extend(self._build_transport(name, server).list_tools())

        return tools

    def call_tool(
            self,
            server_name: str,
            tool_name: str,
            arguments: dict[str, Any]
    ) -> McpToolResult:
        server = self._get_enabled_server(server_name)
        return self._build_transport(server_name, server).call_tool(tool_name, arguments)

    def _get_enabled_server(self, server_name: str) -> McpServerConfig:
        server = self.config.servers.get(server_name)
        if server is None:
            raise AppException(
                message=f"MCP server not found: {server_name}",
                code=404,
                status_code=404,
            )
        if not server.enabled:
            raise AppException(
                message=f"MCP server is disabled: {server_name}",
                code=400,
                status_code=400,
            )
        return server

    @staticmethod
    def _build_transport(server_name: str, server: McpServerConfig) -> McpTransportClient:
        if server.transport == "demo":
            return DemoMcpTransportClient(server_name, server)
        if server.transport == "stdio":
            return StdioMcpTransportClient(server_name, server)
        if server.transport == "streamable_http":
            return StreamableHttpMcpTransportClient(server_name, server)
        if server.transport == "sse":
            return SseMcpTransportClient(server_name, server)
        raise AppException(
            message=f"unsupported MCP transport: {server.transport}",
            code=500,
            status_code=500,
        )


def build_mcp_client_manager() -> McpClientManager:
    return McpClientManager()
