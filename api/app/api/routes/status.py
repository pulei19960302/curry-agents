from fastapi import APIRouter

from app.core.config import settings
from app.schemas.status import StatusResponse

# 用来组织一组接口
router = APIRouter(prefix="/status", tags=["status"])

@router.get("", response_model=StatusResponse)
async def get_status() -> StatusResponse:
    return StatusResponse(
        service= settings.api_app_name,
        environment=settings.api_env,
        status="ok",
        version=settings.api_version,
    )
