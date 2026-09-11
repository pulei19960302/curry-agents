from fastapi import APIRouter, Depends

from app.application.mcp_intro_service import McpIntroService
from app.schemas.common import ApiResponse
from app.schemas.mcp import (
    McpConceptsResponse, McpRoleResponse,
    McpCapabilityResponse, McpToolListResponse,
    McpToolDemoResponse, McpToolCallRequest, McpToolCallResponse
)

router = APIRouter(prefix="/mcp", tags=["mcp"])


def build_mcp_intro_service() -> McpIntroService:
    return McpIntroService()


@router.get("/concepts", response_model=ApiResponse[McpConceptsResponse])
async def get_mcp_concepts(
        service: McpIntroService = Depends(build_mcp_intro_service),
) -> ApiResponse[McpConceptsResponse]:
    """返回 Host、Client、Server 和 MCP 能力类型说明。"""

    return ApiResponse(
        data=McpConceptsResponse(
            roles=[McpRoleResponse.model_validate(role) for role in service.list_roles()],
            capabilities=[
                McpCapabilityResponse.model_validate(capability)
                for capability in service.list_capabilities()
            ],
            transports=["stdio", "Streamable HTTP"],
            protocol="JSON-RPC 2.0 message format",
        )
    )


@router.get("/demo/tools", response_model=ApiResponse[McpToolListResponse])
async def list_mcp_demo_tools(
        service: McpIntroService = Depends(build_mcp_intro_service),
) -> ApiResponse[McpToolListResponse]:
    return ApiResponse(
        data=McpToolListResponse(
            item=[McpToolDemoResponse.model_validate(tool) for tool in service.list_demo_tools()]
        )
    )


@router.post("/demo/call", response_model=ApiResponse[McpToolCallResponse])
async def call_mcp_demo_tool(
        payload: McpToolCallRequest,
        service: McpIntroService = Depends(build_mcp_intro_service),
) -> ApiResponse[McpToolCallResponse]:
    """模拟一次 MCP tools/call 调用流程。"""

    result = service.call_demo_tools(
        tool_name=payload.tool_name,
        arguments=payload.arguments,
    )

    return ApiResponse(
        data=McpToolCallResponse.model_validate(result),
    )
