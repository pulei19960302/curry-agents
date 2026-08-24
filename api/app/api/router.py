from fastapi import APIRouter

from app.api.routes import status, sessions

# 创建总路由
api_router = APIRouter()


# 注册路由
api_router.include_router(status.router, tags=["status"])
api_router.include_router(sessions.router)
