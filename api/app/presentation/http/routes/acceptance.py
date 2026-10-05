from fastapi import APIRouter, Depends

from app.application.product_acceptance_service import ProductAcceptanceService
from app.schemas.acceptance import (
    ProductAcceptanceChecklistResponse, ProductAcceptanceItemResponse, ProductAcceptanceSummaryResponse
)
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/acceptance", tags=["acceptance"])


def build_product_acceptance_service() -> ProductAcceptanceService:
    return ProductAcceptanceService()


@router.get("/checks", response_model=ApiResponse[ProductAcceptanceChecklistResponse])
async def get_product_acceptance_checks(
        service: ProductAcceptanceService = Depends(build_product_acceptance_service),
) -> ApiResponse[ProductAcceptanceChecklistResponse]:
    # ===================== 第1步：读取最终产品体验验收清单 =====================
    checklist = service.get_checklist()

    # ===================== 第2步：转换为前端可以直接渲染的响应结构 =====================
    return ApiResponse(data=ProductAcceptanceChecklistResponse(
        items=[
            ProductAcceptanceItemResponse.model_validate(c) for c in checklist.items
        ],
        summary=ProductAcceptanceSummaryResponse.model_validate(checklist.summary),
    ))
