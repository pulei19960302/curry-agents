from typing import Any

from app.domain.mcp.entities import McpServerInfo, McpTool, McpToolResult
from app.infrastructure.mcp.mcp_client_manager import build_mcp_client_manager, McpClientManager


class McpService:
    """真实 MCP 工具接入的应用服务。"""

    def __init__(self, manager: McpClientManager | None = None) -> None:
        # manager 负责传输层细节，service 负责应用层语义。
        self.manager = manager or build_mcp_client_manager()

    # 读取 MCP Server 配置状态
    def list_servers(self) -> list[McpServerInfo]:
        """返回所有配置过的 MCP Server。"""

        return self.manager.list_servers()

    # 发现 MCP 工具
    def list_tools(self, server_name: str | None = None) -> list[McpTool]:
        """读取某个 Server 或全部 Server 暴露的工具。"""

        return self.manager.list_tools(server_name=server_name)

    # 调用工具
    def call_tool(self, server_name: str,
                  tool_name: str,
                  arguments: dict[str, Any]) -> McpToolResult:
        return self.manager.call_tool(server_name, tool_name, arguments)
