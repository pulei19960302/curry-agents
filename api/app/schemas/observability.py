from app.schemas.common import ResponseSchema


class ObservabilityCheckResponse(ResponseSchema):
    key: str
    name: str
    category: str
    description: str
    command: str
    expected: str


class ObservabilityCheckListResponse(ResponseSchema):
    items: list[ObservabilityCheckResponse]
