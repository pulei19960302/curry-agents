from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

DataType = TypeVar("DataType")


class ApiError(BaseModel):
    type: str
    source: str
    user_message: str
    suggestion: str
    request_id: str | None = None
    details: dict | None = None


class ApiResponse(BaseModel, Generic[DataType]):
    code: int = 200
    message: str = "success"
    data: DataType | None = None
    error: ApiError | None = None


# 响应模型基类
class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
