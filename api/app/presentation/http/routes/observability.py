from fastapi import APIRouter, Depends

from app.application.observability_service import ObservabilityService
from app.schemas.common import ApiResponse
from app.schemas.observability import ObservabilityCheckListResponse, ObservabilityCheckResponse

router = APIRouter(prefix="/observability", tags=["observability"])


def build_observability_service() -> ObservabilityService:
    return ObservabilityService()


@router.get("/checks", response_model=ApiResponse[ObservabilityCheckListResponse])
async def list_observability_checks(
        service: ObservabilityService = Depends(build_observability_service),
) -> ApiResponse[ObservabilityCheckListResponse]:
    # 获取所有检查结果
    checks = service.list_checks()

    # 转换成统一响应结构
    return ApiResponse(
        data=ObservabilityCheckListResponse(
            items=[ObservabilityCheckResponse.model_validate(check) for check in checks],
        )
    )
