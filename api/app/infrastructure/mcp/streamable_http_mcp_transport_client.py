import httpx
from itertools import count
from typing import Any

from app.core.exceptions import AppException
from app.domain.mcp.entities import McpToolResult, McpTool
from app.infrastructure.mcp.client import McpTransportClient

_json_rpc_ids = count(1)


class StreamableHttpMcpTransportClient(McpTransportClient):
    """
        最小 Streamable HTTP MCP 客户端。
        真实 MCP Server 可能还有初始化、会话和通知等细节。本章先实现
        `tools/list` 和 `tools/call` 两个最关键请求，让项目具备扩展点。
    """

    def list_tools(self) -> list[McpTool]:
        result = self._send_json_rpc("tools/list", {})
        tools = result.get("tools") or []

        return [
            McpTool(
                server_name=self.server_name,
                name=str(tool.get("name") or ""),
                description=str(tool.get("description") or ""),
                input_schema=dict(tool.get("inputSchema") or {}),
            )
            for tool in tools
        ]

    def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> McpToolResult:
        result = self._send_json_rpc(
            "tools/call",
            {"name": tool_name, "arguments": arguments}
        )
        return McpToolResult(
            server_name=self.server_name,
            tool_name=tool_name,
            arguments=arguments,
            content=list(result.get("content") or []),
        )

    def _send_json_rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        request_body = {
            "jsonrpc": "2.0",
            "id": next(_json_rpc_ids),
            "method": method,
            "params": params,
        }

        try:
            response = httpx.post(
                url=str(self.config.url),
                json=request_body,
                timeout=self.config.timeout_seconds

            )

        except httpx.HTTPError as exc:
            raise AppException(
                message=f"MCP HTTP request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

        payload = response.json()

        if payload.get("error"):
            raise AppException(
                message=f"MCP JSON-RPC error: {payload['error']}",
                code=502,
                status_code=502,
            )

        result = payload.get("result")
        return result if isinstance(result, dict) else {}
