from typing import Literal

from pydantic import Field

from app.schemas.common import ResponseSchema

SettingsIntegrationKind = Literal[
    "llm",
    "search",
    "mcp",
    "a2a",
    "multi_agent",
    "sandbox"
]


class SettingsItemResponse(ResponseSchema):
    name: str  # 配置项名称 比如 provider name、MCP server name 或 Agent key
    description: str  # 配置项说明，前端设置页直接展示。
    enabled: bool  # 当前配置项是否可用。
    metadata: dict[str, object]  # 额外信息，例如 transport、url、api_key_env。


class SettingsModuleResponse(ResponseSchema):
    key: SettingsIntegrationKind  # 模块稳定标识，例如 llm、mcp、a2a、multi_agent。
    name: str  # 展示名称。
    description: str  # 模块作用说明。
    enabled: bool  # 设置页中的运行时启用状态。
    default_item: str | None  # 当前默认项，例如默认 provider 或默认远程 Agent。
    items: list[SettingsItemResponse]  # 模块下的配置项列表。
    status: str
    status_message: str
    source: str
    verify_command: str


class SettingsIntegrationResponse(ResponseSchema):
    id: str  # 运行时集成记录 ID。
    kind: SettingsIntegrationKind  # 集成类型。
    name: str  # 集成名称。
    description: str  # 集成说明。
    endpoint: str | None  # 外部服务地址，某些集成可以为空。
    enabled: bool  # 当前记录是否启用。


"""
AppSettingsResponse
  |
  +-- modules       LLM/MCP/A2A/多 Agent 模块
  |
  +-- integrations  用户新增的运行时集成记录
"""


class AppSettingsResponse(ResponseSchema):
    modules: list[SettingsModuleResponse]
    integrations: list[SettingsIntegrationResponse]


class SettingsModuleUpdateRequest(ResponseSchema):
    enabled: bool | None = None
    default_item: str | None = Field(default=None, max_length=120)


class SettingsIntegrationCreateRequest(ResponseSchema):
    kind: SettingsIntegrationKind
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    endpoint: str | None = Field(default=None, max_length=500)
