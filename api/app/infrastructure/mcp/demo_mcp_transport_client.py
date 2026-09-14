from typing import Any

from app.core.exceptions import AppException
from app.domain.mcp.entities import McpTool, McpToolResult
from app.infrastructure.mcp.client import McpTransportClient


class DemoMcpTransportClient(McpTransportClient):

    def list_tools(self) -> list[McpTool]:
        return [
            McpTool(
                server_name=self.server_name,
                name="mcp_echo",
                description="返回调用方传入的文本。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "text": {"type": "string", "description": "需要原样返回的文本。"}
                    },
                    "required": ["text"],
                }
            ),
            McpTool(
                server_name=self.server_name,
                name="mcp_add_note",
                description="模拟创建一条外部笔记。",
                input_schema={
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "笔记标题。"},
                        "content": {"type": "string", "description": "笔记正文。"},
                    },
                    "required": ["title", "content"],
                },
            ),
        ]

    def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> McpToolResult:
        tool_names = {tool.name for tool in self.list_tools()}

        if tool_name not in tool_names:
            raise AppException(
                message=f"MCP tool not found: {self.server_name}.{tool_name}",
                code=404,
                status_code=404,
            )

        if tool_name == "mcp_echo":
            text = str(arguments.get("text") or "")

            if not text:
                raise AppException(
                    message="argument is required: text",
                    code=400,
                    status_code=400,
                )

            content: list[dict[str, Any]] = [{"type": "text", "text": f"echo: {text}"}]

        else:
            title = str(arguments.get("title") or "")
            body = str(arguments.get("content") or "")
            if not title or not body:
                raise AppException(
                    message="arguments are required: title, content",
                    code=400,
                    status_code=400,
                )
            content = [{"type": "text", "text": f"note created: {title}"}]

        return McpToolResult(
            server_name=self.server_name,
            tool_name=tool_name,
            arguments=arguments,
            content=content,
        )
