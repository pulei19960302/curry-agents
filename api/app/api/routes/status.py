from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import ApiResponse
from app.schemas.status import StatusData

# 用来组织一组接口
router = APIRouter(prefix="/status", tags=["status"])

@router.get("", response_model=ApiResponse[StatusData])
async def get_status() -> ApiResponse[StatusData]:
    return ApiResponse(data = StatusData(
        service= settings.api_app_name,
        environment=settings.api_env,
        status="ok",
        version=settings.api_version,
    ))
