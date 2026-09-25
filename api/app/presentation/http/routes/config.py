from fastapi import APIRouter, Depends

from app.application.app_settings_service import AppSettingsService, get_app_settings_service
from app.application.llm_service import LLMService
from app.core.exceptions import AppException
from app.schemas.app_settings import AppSettingsResponse, SettingsModuleResponse, SettingsModuleUpdateRequest, \
    SettingsIntegrationCreateRequest, SettingsIntegrationResponse
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


@router.get("/app", response_model=ApiResponse[AppSettingsResponse])
async def get_app_settings(
        service: AppSettingsService = Depends(get_app_settings_service),
) -> ApiResponse[AppSettingsResponse]:
    # 设置页一次请求就能拿到 LLM、MCP、A2A 和多 Agent 的配置摘要。
    return ApiResponse(
        data=AppSettingsResponse.model_validate(service.get_snapshot())
    )


@router.patch("/modules/{module_key}", response_model=ApiResponse[SettingsModuleResponse])
async def update_settings_module(
        module_key: str,
        payload: SettingsModuleUpdateRequest,
        service: AppSettingsService = Depends(get_app_settings_service),
) -> ApiResponse[SettingsModuleResponse]:
    try:
        module = service.update_module(
            module_key=module_key,
            enabled=payload.enabled,
            default_item=payload.default_item,
        )
    except KeyError as exc:
        raise AppException(
            message=f"settings module not found: {module_key}",
            code=404,
            status_code=404,
        ) from exc
    return ApiResponse(data=SettingsModuleResponse.model_validate(module))


@router.post("/integrations", response_model=ApiResponse[SettingsIntegrationResponse])
async def create_settings_integration(
        payload: SettingsIntegrationCreateRequest,
        service: AppSettingsService = Depends(get_app_settings_service),
) -> ApiResponse[SettingsIntegrationResponse]:
    # service add
    integration = service.add_integration(
        kind=payload.kind,
        name=payload.name,
        description=payload.description,
        endpoint=payload.endpoint,
    )

    return ApiResponse(data=SettingsIntegrationResponse.model_validate(integration))


@router.delete("/integrations/{integration_id}", response_model=ApiResponse[SettingsIntegrationResponse])
async def delete_settings_integration(
        integration_id: str,
        service: AppSettingsService = Depends(get_app_settings_service),
) -> ApiResponse[SettingsIntegrationResponse]:
    try:
        integration = service.delete_integration(integration_id)
    except KeyError as exc:
        raise AppException(
            message=f"settings integration not found: {integration_id}",
            code=404,
            status_code=404,
        ) from exc

    return ApiResponse(data=SettingsIntegrationResponse.model_validate(integration))
