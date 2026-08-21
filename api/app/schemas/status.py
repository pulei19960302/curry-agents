from pydantic import BaseModel


# 模型描述 /api/status 的响应结构
class StatusData(BaseModel):
    service: str
    environment: str
    status: str
    version: str

# 数据库状态
class DatabaseStatusData(BaseModel):
    status: str
