from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# 定义工具 schema 响应
class ToolParameterResponse(BaseModel):
    name: str
    type: str
    description: str
    required: bool


# 工具的定义
class ToolDefinitionResponse(BaseModel):
    name: str
    description: str
    parameters: list[ToolParameterResponse]


# 获取所有工具
class ToolListResponse(BaseModel):
    items: list[ToolDefinitionResponse]


# 定义 Memory 消息响应
class MemoryMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime
    name: str | None = None


# 定义工具调用结果响应
class ToolCallResultResponse(BaseModel):
    tool_name: str
    arguments: dict
    output: str


# 定义最小 Agent 演示请求和响应
class AgentCoreDemoRequest(BaseModel):
    task: str = Field(min_length=1, max_length=1000)
    tool_name: str | None = None


# demo的演示结果
class AgentCoreDemoResponse(BaseModel):
    messages: list[MemoryMessageResponse]
    selected_tool: ToolDefinitionResponse
    tool_result: ToolCallResultResponse
    next_step: str
