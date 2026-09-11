from pydantic import Field
from typing import Any

from app.schemas.common import ResponseSchema


class McpRoleResponse(ResponseSchema):
    name: str  # Host、Client 或 Server。
    responsibility: str  # 这个角色在 MCP 架构中负责什么。
    example: str  # 在 CurryAgent 项目中可以类比到哪里。


class McpCapabilityResponse(ResponseSchema):
    name: str  # tools、resources 或 prompts。
    description: str  # 这类能力解决什么问题。
    curry_agent_mapping: str  # 和当前项目已有模块的对应关系。


class McpConceptsResponse(ResponseSchema):
    roles: list[McpRoleResponse]
    capabilities: list[McpCapabilityResponse]  # 展示 MCP Server 可以暴露什么能力
    transports: list[str]  # 第 31 章只解释名称，第 32 章再实现真实连接。
    protocol: str  # MCP 数据层使用的协议说明。


class McpToolDemoResponse(ResponseSchema):
    name: str  # 模拟 MCP Server 暴露的工具名。
    description: str  # 工具用途说明。
    input_schema: dict[str, Any]  # MCP tools/list 中常见的 JSON Schema。


class McpToolListResponse(ResponseSchema):
    item: list[McpToolDemoResponse]


class McpToolCallRequest(ResponseSchema):
    tool_name: str = Field(min_length=1, max_length=100)
    arguments: dict[str, Any] = Field(default_factory=dict)


class McpCallStepResponse(ResponseSchema):
    index: int  # 调用流程中的第几步。
    action: str  # 例如 tools/list、tools/call。
    detail: str  # 对这一步发生了什么的解释。


class McpToolCallResponse(ResponseSchema):
    tool_name: str
    arguments: dict[str, Any]
    content: list[dict[str, str]]  # MCP 工具结果通常用 content 数组承载。
    steps: list[McpCallStepResponse]
