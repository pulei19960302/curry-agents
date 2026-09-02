from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.application.agent_task_runner import AgentTaskRunner
from app.core.config import settings
from app.core.handlers import register_exception_handlers
from app.core.logging import configure_logging
from app.infrastructure.database.session import AsyncSessionLocal
from app.infrastructure.redis_task.task_queue import create_redis_client, RedisAgentTaskQueue


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 创建 Redis 连接和任务队列
    redis = create_redis_client()
    queue = RedisAgentTaskQueue(redis)
    # 启动 AgentTaskRunner 后台循环
    runner = AgentTaskRunner(queue=queue, session_factory=AsyncSessionLocal)
    app.state.task_queue = queue
    app.state.task_runner = runner
    # 发送ping 判断链接状态
    await redis.ping()
    runner.start()

    try:
        yield
    finally:
        # 应用关闭时释放后台任务和 Redis 连接
        await runner.stop()
        await redis.aclose()


def create_app() -> FastAPI:
    # 增加日志
    configure_logging()

    app_instance = FastAPI(
        title=settings.api_app_name,
        version=settings.api_version,
        lifespan=lifespan
    )
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    # 注册异常捕捉
    register_exception_handlers(app_instance)
    app_instance.include_router(api_router, prefix=settings.api_prefix)

    return app_instance


app = create_app()
