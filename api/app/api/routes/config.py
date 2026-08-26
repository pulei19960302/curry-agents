from fastapi import APIRouter, Depends

from app.application.llm_service import LLMService
from app.schemas.common import ApiResponse
from app.schemas.llm import LLMConfigResponse

router = APIRouter(prefix="/config", tags=["config"])


def build_llm_server() -> LLMService:
    return LLMService()


# 暴露不含密钥的 LLM 配置接口

@router.get("/llm", response_model=ApiResponse[LLMConfigResponse])
async def get_config(
        service: LLMService = Depends(build_llm_server),
) -> ApiResponse[LLMConfigResponse]:
    return ApiResponse(
        data=LLMConfigResponse.model_validate(service.get_public_config())
    )
