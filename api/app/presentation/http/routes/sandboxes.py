from fastapi import APIRouter, Depends, Query

from app.core.config import settings
from app.infrastructure.sandbox.manager import DockerSandboxManager
from app.schemas.common import ApiResponse
from app.schemas.sandbox import SandboxInstanceResponse, SandboxWaitRequest, SandboxFileReadResponse, \
    SandboxFileWriteResponse, SandboxFileWriteRequest, SandboxShellRunResponse, SandboxShellRunRequest, \
    SandboxVncStatusResponse

router = APIRouter(prefix="/sandboxes", tags=["sandboxes"])


def build_sandbox_manager() -> DockerSandboxManager:
    return DockerSandboxManager(settings=settings)


@router.get("/current", response_model=ApiResponse[SandboxInstanceResponse])
async def get_current_sandbox(
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxInstanceResponse]:
    return ApiResponse(
        data=SandboxInstanceResponse.model_validate(manager.ensure_current())
    )


@router.post("/current/ensure", response_model=ApiResponse[SandboxInstanceResponse])
async def ensure_current_sandbox(
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxInstanceResponse]:
    return ApiResponse(data=SandboxInstanceResponse.model_validate(manager.ensure_current()))


@router.post("/current/wait", response_model=ApiResponse[SandboxInstanceResponse])
async def wait_current_sandbox(
        payload: SandboxWaitRequest,
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxInstanceResponse]:
    return ApiResponse(data=SandboxInstanceResponse.model_validate(
        manager.wait_until_ready(
            retries=payload.retries,
            interval_seconds=payload.interval_seconds
        )
    ))


@router.delete("/current", response_model=ApiResponse[SandboxInstanceResponse])
async def release_current_sandbox(
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxInstanceResponse]:
    return ApiResponse(data=SandboxInstanceResponse.model_validate(manager.release_current()))


@router.get("/current/files/read", response_model=ApiResponse[SandboxFileReadResponse])
async def read_sandbox_file(
        path: str = Query(min_length=1),
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxFileReadResponse]:
    return ApiResponse(data=SandboxFileReadResponse(**manager.read_file(path)))


@router.post(
    "/current/files/write",
    response_model=ApiResponse[SandboxFileWriteResponse],
)
async def write_sandbox_file(
        payload: SandboxFileWriteRequest,
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxFileWriteResponse]:
    return ApiResponse(
        data=SandboxFileWriteResponse(
            **manager.write_file(
                path=payload.path,
                content=payload.content,
                create_parent=payload.create_parent,
            )
        )
    )


@router.post(
    "/current/shell/run",
    response_model=ApiResponse[SandboxShellRunResponse],
)
async def run_sandbox_shell(
        payload: SandboxShellRunRequest,
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxShellRunResponse]:
    return ApiResponse(
        data=SandboxShellRunResponse(
            **manager.run_shell(
                command=payload.command,
                cwd=payload.cwd,
                timeout_seconds=payload.timeout_seconds,
            )
        )
    )


@router.get("/current/vnc/status", response_model=ApiResponse[SandboxVncStatusResponse])
async def get_vnc_status(
        manager: DockerSandboxManager = Depends(build_sandbox_manager),
) -> ApiResponse[SandboxVncStatusResponse]:
    return ApiResponse(data=SandboxVncStatusResponse.model_validate(manager.get_vnc_status()))
