from fastapi import APIRouter, Depends

from app.application.a2a_intro_service import A2aIntroService
from app.application.a2a_service import A2aService
from app.schemas.a2a import A2aConceptsResponse, A2aRoleResponse, A2aAgentCardResponse, A2aMessageDemoResponse, \
    A2aMessageSendRequest, A2aRemoteAgentListResponse, A2aTaskResultResponse, A2aAgentCardRequest, \
    A2aMessageInvokeRequest, A2aRemoteAgentResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/a2a", tags=["a2a"])


def build_a2a_intro_service() -> A2aIntroService:
    return A2aIntroService()


def build_a2a_service() -> A2aService:
    return A2aService()


@router.get("/concepts", response_model=ApiResponse[A2aConceptsResponse])
async def get_a2a_concepts(
        service: A2aIntroService = Depends(build_a2a_intro_service)
) -> ApiResponse[A2aConceptsResponse]:
    return ApiResponse(
        data=A2aConceptsResponse(
            roles=[A2aRoleResponse.model_validate(role) for role in service.list_roles()],
            protocol="Agent-to-Agent task and message collaboration",
            next_step="第 35 章会把远程 Agent 注册成可调用工具。",
        )
    )


@router.get("/demo/agent-card", response_model=ApiResponse[A2aAgentCardResponse])
async def get_a2a_demo_agent_card(
        service: A2aIntroService = Depends(build_a2a_intro_service),
) -> ApiResponse[A2aAgentCardResponse]:
    """返回一个课程内置的示例 Agent Card。"""

    return ApiResponse(data=A2aAgentCardResponse.model_validate(service.get_demo_agent_card()))


@router.post("/demo/message", response_model=ApiResponse[A2aMessageDemoResponse])
async def send_a2a_demo_message(
        payload: A2aMessageSendRequest,
        service: A2aIntroService = Depends(build_a2a_intro_service),
) -> ApiResponse[A2aMessageDemoResponse]:
    """模拟 Host Agent 向远程 Agent 发送任务消息。"""

    demo = service.send_demo_message(payload.message)
    return ApiResponse(data=A2aMessageDemoResponse.model_validate(demo))


@router.get("/agents", response_model=ApiResponse[A2aRemoteAgentListResponse])
async def list_agents(
        service: A2aService = Depends(build_a2a_service),
) -> ApiResponse[A2aRemoteAgentListResponse]:
    agents = service.list_agents()

    return ApiResponse(
        data=A2aRemoteAgentListResponse(
            item=[A2aRemoteAgentResponse.model_validate(agent) for agent in agents],
        )
    )


@router.get("/agents/{agent_key}/card", response_model=ApiResponse[A2aAgentCardResponse])
async def get_agent_card(
        agent_key: str,
        service: A2aService = Depends(build_a2a_service),
) -> ApiResponse[A2aAgentCardResponse]:
    return ApiResponse(
        data=A2aAgentCardResponse.model_validate(service.get_agent_card(agent_key))
    )


@router.post("/agents/card", response_model=ApiResponse[A2aAgentCardResponse])
async def agent_card(
        payload: A2aAgentCardRequest,
        service: A2aService = Depends(build_a2a_service),
) -> ApiResponse[A2aAgentCardResponse]:
    return ApiResponse(
        data=A2aAgentCardResponse.model_validate(service.get_agent_card(payload.agent_key))
    )


@router.post("/message/send", response_model=ApiResponse[A2aTaskResultResponse])
async def send_agent_message(
        payload: A2aMessageInvokeRequest,
        service: A2aService = Depends(build_a2a_service),
) -> ApiResponse[A2aTaskResultResponse]:
    return ApiResponse(
        data=A2aTaskResultResponse.model_validate(
            service.send_message(payload.agent_key, message=payload.message)
        )
    )
