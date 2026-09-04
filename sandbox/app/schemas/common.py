from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    code: int = 200
    message: str = "success"
    data: DataT | None = None
    error: str | None = Field(
        default=None,
        exclude_if=lambda value: value is None,
    )


# 响应模型基类
class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
