from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.handlers import register_exception_handlers
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    # 增加日志
    configure_logging()

    app_instance = FastAPI(
        title= settings.api_app_name,
        version= settings.api_version
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
