from fastapi import APIRouter, Depends

from app.application.mcp_intro_service import McpIntroService
from app.application.mcp_service import McpService
from app.schemas.common import ApiResponse
from app.schemas.mcp import (
    McpConceptsResponse, McpRoleResponse,
    McpCapabilityResponse, McpToolListResponse,
    McpToolDemoResponse, McpToolCallRequest, McpToolCallResponse,
    McpServerListResponse, McpDiscoveredToolListResponse, McpToolInvokeResponse, McpToolInvokeRequest,
    McpServerResponse, McpDiscoveredToolResponse
)

router = APIRouter(prefix="/mcp", tags=["mcp"])


def build_mcp_intro_service() -> McpIntroService:
    return McpIntroService()


def build_mcp_service() -> McpService:
    return McpService()


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


@router.get("/servers", response_model=ApiResponse[McpServerListResponse])
async def list_mcp_services(
        service: McpService = Depends(build_mcp_service),
) -> ApiResponse[McpServerListResponse]:
    servers = service.list_servers()

    return ApiResponse(
        data=McpServerListResponse(
            items=[McpServerResponse.model_validate(server) for server in servers]
        )
    )


@router.get("/tools", response_model=ApiResponse[McpDiscoveredToolListResponse])
async def list_mcp_tools(
        server_name: str | None = None,
        service: McpService = Depends(build_mcp_service),
) -> ApiResponse[McpDiscoveredToolListResponse]:
    """读取一个或全部已启用 MCP Server 暴露的工具。"""

    tool_list = service.list_tools(server_name=server_name)

    return ApiResponse(
        data=McpDiscoveredToolListResponse(
            items=[McpDiscoveredToolResponse.model_validate(tool) for tool in tool_list]
        )
    )


@router.post("/call", response_model=ApiResponse[McpToolInvokeResponse])
async def call_mcp_tool(
        payload: McpToolInvokeRequest,
        service: McpService = Depends(build_mcp_service),
) -> ApiResponse[McpToolInvokeResponse]:
    """调用已配置 MCP Server 上的工具。"""

    result = service.call_tool(
        server_name=payload.server_name,
        tool_name=payload.tool_name,
        arguments=payload.arguments,
    )
    return ApiResponse(data=McpToolInvokeResponse.model_validate(result))
