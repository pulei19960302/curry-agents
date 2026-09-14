from abc import ABC, abstractmethod
from typing import Any

from app.core.mcp_config import McpServerConfig
from app.domain.mcp.entities import McpTool, McpToolResult


class McpTransportClient(ABC):
    """MCP 传输层客户端基类。"""

    def __init__(self, server_name: str, config: McpServerConfig) -> None:
        self.server_name = server_name
        self.config = config

    @abstractmethod
    def list_tools(self) -> list[McpTool]:
        """读取当前 Server 暴露的工具列表。"""

    @abstractmethod
    def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> McpToolResult:
        """调用当前 Server 上的一个工具。"""
