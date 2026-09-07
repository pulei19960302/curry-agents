from fastapi import APIRouter

from app.api.routes import status, supervisor, files, shell

api_router = APIRouter()

api_router.include_router(status.router)

api_router.include_router(supervisor.router)

api_router.include_router(files.router)

api_router.include_router(shell.router)
