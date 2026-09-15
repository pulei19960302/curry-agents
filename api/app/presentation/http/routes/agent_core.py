from fastapi import APIRouter, Depends

from app.application.agent_core_service import AgentCoreService
from app.domain.agent_core.memory import MemoryMessage
from app.domain.agent_core.tools import ToolParameter, ToolDefinition, ToolCallResult
from app.schemas.agent_core import ToolParameterResponse, ToolDefinitionResponse, MemoryMessageResponse, \
    ToolCallResultResponse, ToolListResponse, AgentCoreDemoResponse, AgentCoreDemoRequest
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/agent-core", tags=["agent-core"])


def build_agent_core_service() -> AgentCoreService:
    """创建 AgentCoreService。

    当前服务只依赖内置工具注册表，不需要数据库连接。
    """
    return AgentCoreService()


# 把领域对象转换成接口响应
def to_parameter_response(parameter: ToolParameter) -> ToolParameterResponse:
    return ToolParameterResponse(
        name=parameter.name,
        type=parameter.type,
        description=parameter.description,
        required=parameter.required,
    )


def to_tool_response(definition: ToolDefinition) -> ToolDefinitionResponse:
    return ToolDefinitionResponse(
        name=definition.name,
        description=definition.description,
        parameters=[
            to_parameter_response(parameter)
            for parameter in definition.parameters
        ],
    )


def to_memory_message_response(message: MemoryMessage) -> MemoryMessageResponse:
    return MemoryMessageResponse(
        id=message.id,
        role=message.role.value,
        content=message.content,
        created_at=message.created_at,
        name=message.name,
    )


def to_tool_result_response(result: ToolCallResult) -> ToolCallResultResponse:
    return ToolCallResultResponse(
        tool_name=result.tool_name,
        arguments=result.arguments,
        output=result.output,
    )


@router.get("/tools", response_model=ApiResponse[ToolListResponse])
async def get_list_tools(
        service: AgentCoreService = Depends(build_agent_core_service),
) -> ApiResponse[ToolListResponse]:
    return ApiResponse(
        data=ToolListResponse(
            items=[to_tool_response(tool) for tool in service.list_tools()],
        )
    )


@router.post("/demo", response_model=ApiResponse[AgentCoreDemoResponse])
async def run_demo(
        payload: AgentCoreDemoRequest,
        service: AgentCoreService = Depends(build_agent_core_service),
) -> ApiResponse[AgentCoreDemoResponse]:
    """运行一次 Memory + 工具调用演示。"""

    messages, selected_tool, tool_result, next_step = service.run_demo(
        task=payload.task,
        tool_name=payload.tool_name,
    )
    return ApiResponse(
        data=AgentCoreDemoResponse(
            messages=[
                to_memory_message_response(message)
                for message in messages
            ],
            selected_tool=to_tool_response(selected_tool),
            tool_result=to_tool_result_response(tool_result),
            next_step=next_step,
        )
    )
