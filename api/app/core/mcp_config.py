from pathlib import Path

import yaml
from functools import lru_cache
from pydantic import BaseModel, Field, model_validator
from typing import Literal

from app.core.config import settings
from app.core.exceptions import AppException

McpTransport = Literal["demo", "stdio", "sse", "streamable_http"]


class McpServerConfig(BaseModel):
    enabled: bool = True  # 是否参与默认工具发现。
    transport: McpTransport  # 决定使用哪一种传输客户端。
    description: str = ""  # 给前端展示和排查配置用。
    command: str | None = None  # stdio Server 的启动命令
    args: list[str] = Field(default_factory=list)  # stdio 命令参数。
    url: str | None = None  # HTTP/SSE Server 地址。
    timeout_seconds: float = Field(default=10.0, ge=0)  # 单次请求超时

    @model_validator(mode="after")
    def validate_transport_fields(self) -> "McpServerConfig":
        """根据传输方式校验必需字段。"""
        if self.transport == "stdio" and not self.command:
            raise ValueError("stdio MCP server requires command")

        if self.transport in {"sse", "streamable_http"} and not self.url:
            raise ValueError(f"{self.transport} MCP server requires url")
        return self


class McpDefaults(BaseModel):
    enabled: bool = True  # MCP 总开关。
    default_server: str = "demo"  # 没有显式选择 Server 时使用哪个。


class McpConfig(BaseModel):
    mcp: McpDefaults
    servers: dict[str, McpServerConfig]


@lru_cache
def load_mcp_config() -> McpConfig:
    """读取 MCP YAML 配置。"""
    path = Path(settings.mcp_config_path)

    if not path.is_file():
        raise AppException(
            message=f"MCP config file not found: {settings.mcp_config_path}",
            code=500,
            status_code=500,
        )

    raw_config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    config = McpConfig.model_validate(raw_config)

    if config.mcp.default_server not in config.servers:
        raise AppException(
            message="default MCP server is not defined",
            code=500,
            status_code=500,
        )

    return config
