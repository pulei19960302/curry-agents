from fastapi import APIRouter, Depends

from app.application.multi_agent_service import MultiAgentService
from app.schemas.common import ApiResponse
from app.schemas.multi_agent import MultiAgentRoleListResponse, MultiAgentRoleResponse, MultiAgentRunRequest, \
    MultiAgentRunResponse

router = APIRouter(prefix="/multi-agent", tags=["multi-agent"])


# 构建multi agent service
def build_multi_agent_service() -> MultiAgentService:
    return MultiAgentService()


@router.get("/roles", response_model=ApiResponse[MultiAgentRoleListResponse])
def list_multi_agent_roles(
        service: MultiAgentService = Depends(build_multi_agent_service),
) -> ApiResponse[MultiAgentRoleListResponse]:
    return ApiResponse(
        data=MultiAgentRoleListResponse(
            items=[MultiAgentRoleResponse.model_validate(role) for role in service.list_roles()],
        )
    )


@router.post("/run", response_model=ApiResponse[MultiAgentRunResponse])
def run_multi_agent_collaboration(
        payload: MultiAgentRunRequest,
        service: MultiAgentService = Depends(build_multi_agent_service),
) -> ApiResponse[MultiAgentRunResponse]:
    """围绕一个任务运行 Manager -> Worker -> Reviewer -> 汇总流程。"""

    # 1. 接收调用方传来的 task。
    # 2. 应用服务负责编排角色、分派子任务、评审并汇总。

    result = service.run_collaboration(payload.task)

    return ApiResponse(
        data=MultiAgentRunResponse.model_validate(result),
    )
