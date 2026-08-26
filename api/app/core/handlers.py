import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.core.exceptions import AppException
from app.schemas.common import ApiResponse

logger = logging.getLogger(__name__)


def build_error_response(code: int, message: str, status_code: int) -> JSONResponse:
    payload = ApiResponse[object](code=code, message=message, data=None)
    return JSONResponse(status_code=status_code, content=payload.model_dump())


async def app_exception_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    if not isinstance(exc, AppException):
        raise exc

    return build_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
    )


async def http_exception_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    if not isinstance(exc, HTTPException):
        raise exc

    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return build_error_response(
        code=exc.status_code,
        message=message,
        status_code=exc.status_code,
    )


async def validation_exception_handler(
    _request: Request,
    _exc: Exception,
) -> JSONResponse:
    return build_error_response(
        code=422,
        message="Request Validation Error",
        status_code=422,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception(
        "Unhandled exception while processing %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return build_error_response(
        code=500,
        message="Internal Server Error",
        status_code=500,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
