from fastapi import APIRouter, Depends

from app.application.security_audit_service import SecurityAuditService
from app.schemas.common import ApiResponse
from app.schemas.security import SecurityCheckListResponse, SecurityCheckResponse

router = APIRouter(prefix="/security", tags=["security"])


def build_security_audit_service() -> SecurityAuditService:
    return SecurityAuditService()


@router.get("/checks", response_model=ApiResponse[SecurityCheckListResponse])
async def list_security_checks(
        service: SecurityAuditService = Depends(build_security_audit_service),
) -> ApiResponse[SecurityCheckListResponse]:
    checks = service.list_checks()

    return ApiResponse(
        data=SecurityCheckListResponse(
            items=[SecurityCheckResponse.model_validate(check) for check in checks],
        )
    )
