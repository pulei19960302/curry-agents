from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class McpServerInfo:
    """一个可用或可配置的 MCP Server。"""

    name: str  # 配置文件中的 server 名。
    enabled: bool  # 是否启用
    transport: str  # 使用那种mcp传输
    description: str  # 给前端和日志查看的


@dataclass(slots=True)
class McpTool:
    """从 MCP Server 发现到的工具描述。"""

    server_name: str  # 工具来自哪个 MCP Server。
    name: str  # MCP 工具名。
    description: str  # MCP Server 返回的工具说明。
    input_schema: dict[str, Any]  # tools/list 返回的参数 JSON Schema。


@dataclass(slots=True)
class McpToolResult:
    """一次 MCP 工具调用的统一结果。"""

    server_name: str  # 实际调用的 Server。
    tool_name: str  # 实际调用的工具。
    arguments: dict[str, Any]  # 传给工具的参数。
    content: list[dict[str, Any]]  # MCP tools/call 返回的 content 数组。
