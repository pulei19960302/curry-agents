from app.schemas.common import ResponseSchema


class SecurityCheckResponse(ResponseSchema):
    key: str
    name: str
    category: str
    severity: str
    risk: str
    recommendation: str
    verify_command: str


class SecurityCheckListResponse(ResponseSchema):
    items: list[SecurityCheckResponse]
