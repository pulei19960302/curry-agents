from pydantic import BaseModel


# 模型描述 /api/status 的响应结构
class StatusResponse(BaseModel):
    service: str
    environment: str
    status: str
    version: str