from app.schemas.common import ResponseSchema


class ProductAcceptanceItemResponse(ResponseSchema):
    key: str
    title: str
    category: str
    status: str
    evidence: str
    verify_steps: list[str]
    related_routes: list[str]


class ProductAcceptanceSummaryResponse(ResponseSchema):
    total: int
    ready: int
    needs_manual_check: int


class ProductAcceptanceChecklistResponse(ResponseSchema):
    summary: ProductAcceptanceSummaryResponse
    items: list[ProductAcceptanceItemResponse]
