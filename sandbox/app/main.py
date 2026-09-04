from app.core.logging_config import configure_logging
from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings
from app.core.handlers import register_exception_handlers


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(
        title=settings.sandbox_app_name,
        version=settings.sandbox_version,
    )

    # 各种异常注册
    register_exception_handlers(app)

    app.include_router(api_router, prefix=settings.sandbox_api_prefix)
    return app


app = create_app()
