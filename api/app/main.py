from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import settings


def create_app() -> FastAPI:
    app_instance = FastAPI(
        title= settings.api_app_name,
        version= settings.api_version
    )
    app_instance.include_router(api_router, prefix=settings.api_prefix)

    return app_instance

app = create_app()
