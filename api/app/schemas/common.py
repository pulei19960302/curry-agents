from typing import Generic, TypeVar

from pydantic import BaseModel, Field, ConfigDict

DataType = TypeVar("DataType")


class ApiResponse(BaseModel, Generic[DataType]):
    code: int = 200
    message: str = "success"
    data: DataType | None = None
    error: str | None = Field(
        default=None,
        exclude_if=lambda value: value is None,
    )


# 响应模型基类
class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
