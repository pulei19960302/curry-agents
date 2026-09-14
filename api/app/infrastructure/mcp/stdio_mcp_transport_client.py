import subprocess
from itertools import count
from pydantic import json
from typing import Any

from app.core.exceptions import AppException
from app.domain.mcp.entities import McpToolResult, McpTool
from app.infrastructure.mcp.client import McpTransportClient

_json_rpc_ids = count(1)


class StdioMcpTransportClient(McpTransportClient):
    """最小 stdio MCP 客户端。

       每次调用都会启动一次命令，写入一条 JSON-RPC 请求，并读取一行响应。
       这种方式适合课程理解协议，不适合长连接生产场景；生产连接管理会在后续加强。
       """

    def list_tools(self) -> list[McpTool]:

        result = self._send_json_rpc(
            method="list_tools",
            params={},
        )
        return [
            McpTool(
                server_name=self.server_name,
                name=str(tool.get("name") or ""),
                description=str(tool.get("description") or ""),
                input_schema=dict(tool.get("inputSchema") or {}),
            )
            for tool in result.get("tools", [])
        ]

    def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> McpToolResult:
        result = self._send_json_rpc(
            "tools/call",
            {"name": tool_name, "arguments": arguments},
        )
        return McpToolResult(
            server_name=self.server_name,
            tool_name=tool_name,
            arguments=arguments,
            content=list(result.get("content") or []),
        )

    def _send_json_rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        if not self.config.command:
            raise AppException(
                message=f"MCP stdio command is missing: {self.server_name}",
                code=500,
                status_code=500,
            )

        request_body = {
            "jsonrpc": "2.0",
            "id": next(_json_rpc_ids),
            "method": method,
            "params": params,
        }

        command = [self.config.command, *self.config.args]

        try:
            completed = subprocess.run(
                command,
                input=json.dumps(request_body),
                capture_output=True,
                check=False,
                encoding="utf-8",
                timeout=self.config.timeout_seconds
            )

        except (OSError, subprocess.TimeoutExpired) as exc:
            raise AppException(
                message=f"MCP stdio request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

        if completed.returncode != 0:
            raise AppException(
                message=f"MCP stdio server exited: {completed.stderr.strip()}",
                code=502,
                status_code=502,
            )

        first_line = completed.stdout.splitlines()[0] if completed.stdout else "{}"
        payload = json.loads(first_line)
        if payload.get("error"):
            raise AppException(
                message=f"MCP JSON-RPC error: {payload['error']}",
                code=502,
                status_code=502,
            )
        result = payload.get("result")
        return result if isinstance(result, dict) else {}
