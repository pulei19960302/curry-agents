import os
from collections.abc import AsyncIterator
from typing import Any

from app.core.exceptions import AppException
from app.core.llm_config import LLMConfig, load_llm_config
from app.domain.llm.entities import (
    LLMChatRequest,
    LLMChatResult,
    LLMMessage,
    LLMStreamChunk,
)
from app.infrastructure.llm.openai_compatible import OpenAICompatibleClient


class LLMService:

    def __init__(self, config: LLMConfig | None = None) -> None:
        self.config = config or load_llm_config()

    def get_public_config(self) -> dict:
        return {
            "default_provider": self.config.llm.default_provider,
            "default_model": self.config.llm.default_model,
            "temperature": self.config.llm.temperature,
            "max_tokens": self.config.llm.max_tokens,
            "providers": [
                {
                    "name": name,
                    "base_url": provider.base_url,
                    "api_key_env": provider.api_key_env,
                    # 只返回是否已配置，不返回真实密钥。
                    "configured": bool(os.getenv(provider.api_key_env)),
                }
                for name, provider in self.config.providers.items()
            ],
        }

    def get_current_provider_config(self, provider_name: str | None = None) -> dict[str, Any]:

        _provider_name = provider_name or self.config.llm.default_provider

        _provider_config = self.config.providers.get(_provider_name)

        if _provider_config is None:
            raise AppException(
                message=f"LLM provider not found: {provider_name}",
                code=400,
                status_code=400,
            )
        api_key = os.getenv(_provider_config.api_key_env)

        if not api_key:
            # 密钥只能来自环境变量，不能写进 YAML，也不能从接口传入。
            raise AppException(
                message=f"LLM api key is not configured: {_provider_config.api_key_env}",
                code=500,
                status_code=500,
            )

        return {
            "provider_name": _provider_name,
            "provider_config": _provider_config,
            "api_key": api_key,
        }

    async def chat(
            self,
            messages: list[LLMMessage],
            provider: str | None = None,
            model: str | None = None,
            temperature: float | None = None,
            max_tokens: int | None = None

    ) -> LLMChatResult:

        current_provide_config = self.get_current_provider_config(provider_name=provider)

        _provider_name: str = current_provide_config.get("provider_name", "")
        provider_config = current_provide_config.get("provider_config", {})
        api_key = current_provide_config.get("api_key", "")

        # 请求参数优先使用接口传入值；没有传入时使用 YAML 默认值。
        request = LLMChatRequest(
            messages=messages,
            model=model or self.config.llm.default_model,
            provider=_provider_name,
            temperature=temperature
            if temperature is not None
            else self.config.llm.temperature,
            max_tokens=max_tokens if max_tokens is not None else self.config.llm.max_tokens,
        )

        # 创建请求客服端
        client = OpenAICompatibleClient(
            api_key=api_key,
            base_url=provider_config.base_url,
            provider=_provider_name,
            timeout_seconds=provider_config.timeout_seconds,
        )

        return await client.chat(request=request)

    # 流式回复
    async def stream_chat(
            self,
            messages: list[LLMMessage],
            provider: str | None = None,
            model: str | None = None,
            temperature: float | None = None,
            max_tokens: int | None = None,
    ) -> AsyncIterator[LLMStreamChunk]:

        current_provide_config = self.get_current_provider_config(provider_name=provider)

        _provider_name: str = current_provide_config.get("provider_name", "")
        provider_config = current_provide_config.get("provider_config", {})
        api_key = current_provide_config.get("api_key", "")

        request = LLMChatRequest(
            messages=messages,
            model=model or self.config.llm.default_model,
            provider=_provider_name,
            temperature=(
                temperature
                if temperature is not None
                else self.config.llm.temperature
            ),
            max_tokens=(
                max_tokens
                if max_tokens is not None
                else self.config.llm.max_tokens
            ),
        )

        client = OpenAICompatibleClient(
            api_key=api_key,
            base_url=provider_config.base_url,
            provider=_provider_name,
            timeout_seconds=provider_config.timeout_seconds,
        )

        async for chunk in client.stream_chat(request=request):
            yield chunk
