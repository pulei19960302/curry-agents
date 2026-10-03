from fastapi import APIRouter, Depends

from app.application.agent_harness_service import AgentHarnessService
from app.schemas.common import ApiResponse
from app.schemas.harness import HarnessCaseListResponse, HarnessCaseResponse, HarnessRunResponse, HarnessRunRequest, \
    HarnessReplayResponse, HarnessEventResponse

router = APIRouter(prefix="/harness", tags=["harness"])

# Harness 运行记录需要跨请求查询和回放，所以这里使用模块级 service。
harness_service = AgentHarnessService()


def build_harness_service() -> AgentHarnessService:
    return harness_service


@router.get("/cases", response_model=ApiResponse[HarnessCaseListResponse])
async def list_harness_cases(
        service: AgentHarnessService = Depends(build_harness_service)
) -> ApiResponse[HarnessCaseListResponse]:
    cases = service.list_cases()

    return ApiResponse(
        data=HarnessCaseListResponse(
            items=[
                HarnessCaseResponse.model_validate(case)
                for case in cases
            ]
        )
    )


@router.post(
    "/cases/{case_id}/run",
    response_model=ApiResponse[HarnessRunResponse],
)
async def run_harness_case(
        case_id: str,
        payload: HarnessRunRequest,
        service: AgentHarnessService = Depends(build_harness_service),
) -> ApiResponse[HarnessRunResponse]:
    run = service.run_case(case_id=case_id, mode=payload.mode)
    return ApiResponse(data=HarnessRunResponse.model_validate(run))


@router.get("/runs/{run_id}", response_model=ApiResponse[HarnessRunResponse])
async def get_harness_run(
        run_id: str,
        service: AgentHarnessService = Depends(build_harness_service),
) -> ApiResponse[HarnessRunResponse]:
    run = service.get_run(run_id)
    return ApiResponse(data=HarnessRunResponse.model_validate(run))


@router.get(
    "/runs/{run_id}/replay",
    response_model=ApiResponse[HarnessReplayResponse],
)
async def replay_harness_run(
        run_id: str,
        service: AgentHarnessService = Depends(build_harness_service),
) -> ApiResponse[HarnessReplayResponse]:
    # 回放接口返回运行信息和事件流，前端可以按时间线重新渲染失败过程。
    run = service.replay_run(run_id)
    return ApiResponse(
        data=HarnessReplayResponse(
            run=HarnessRunResponse.model_validate(run),
            events=[HarnessEventResponse.model_validate(event) for event in run.events],
        )
    )
