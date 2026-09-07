from fastapi import APIRouter, Depends

from app.core.config import settings
from app.schemas.common import ApiResponse
from app.schemas.shell import ShellExecuteRequest, ShellSessionResponse, ShellSessionListResponse, ShellWaitRequest, \
    ShellWriteRequest, ShellWriteResponse, ShellTerminateResponse
from app.services.shell_service import SandboxShellService

router = APIRouter(prefix="/shell", tags=["shell"])

# Shell 会话必须跨请求保存，所以这里使用模块级 service。

"""
原因是 Shell 会话要跨请求保存。
如果每个请求都重新创建一个 SandboxShellService，那么启动命令后，下一次查询就找不到这个会话。
这也是本章和文件 API 最大的区别。文件 API 可以每次创建 service，因为文件状态在磁盘上；Shell API 的会话状态在内存里。
"""
shell_service = SandboxShellService(settings=settings)


def get_shell_service() -> SandboxShellService:
    return shell_service


@router.post("/sessions", response_model=ApiResponse[ShellSessionResponse])
async def execute_command(
        payload: ShellExecuteRequest,
        service: SandboxShellService = Depends(get_shell_service)
) -> ApiResponse[ShellSessionResponse]:
    return ApiResponse(data=await service.execute(payload.command, payload.cwd))


@router.get("/sessions", response_model=ShellSessionListResponse)
async def list_sessions(
        service: SandboxShellService = Depends(get_shell_service),
) -> ApiResponse[ShellSessionListResponse]:
    return ApiResponse(data=service.list_sessions())


@router.get("/sessions/{session_id}", response_model=ApiResponse[ShellSessionResponse])
async def get_session(
        session_id: str,
        service: SandboxShellService = Depends(get_shell_service)
) -> ApiResponse[ShellSessionResponse]:
    return ApiResponse(data=service.get(session_id))


@router.post("/sessions/{session_id}/wait", response_model=ApiResponse[ShellSessionResponse])
async def wait_session(
        session_id: str,
        payload: ShellWaitRequest,
        service: SandboxShellService = Depends(get_shell_service),
) -> ApiResponse[ShellSessionResponse]:
    return ApiResponse(data=await service.wait(session_id, timeout_seconds=payload.timeout_seconds))


@router.post("/sessions/{session_id}/write", response_model=ShellSessionResponse)
async def write_session(
        session_id: str,
        payload: ShellWriteRequest,
        service: SandboxShellService = Depends(get_shell_service)
) -> ApiResponse[ShellWriteResponse]:
    return ApiResponse(data=await service.write(session_id, value=payload.input))


@router.post("/sessions/{session_id}/terminate", response_model=ShellSessionResponse)
async def terminate_session(
        session_id: str,
        service: SandboxShellService = Depends(get_shell_service)
) -> ApiResponse[ShellTerminateResponse]:
    return ApiResponse(data=await service.terminate(session_id))
