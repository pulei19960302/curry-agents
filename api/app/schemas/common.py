from typing import Generic, TypeVar

from pydantic import BaseModel, Field

DataType = TypeVar("DataType")

class ApiResponse(BaseModel, Generic[DataType]):
    code: int = 200
    message: str = "success"
    data: DataType | None = None
    error: str | None = Field(
        default=None,
        exclude_if=lambda value: value is None,
    )
