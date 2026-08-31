# 封装 OpenAI 兼容的 HTTP 客户端

import logging

import httpx

from app.core.exceptions import AppException
from app.core.logging import format_log_json
from app.domain.llm.entities import LLMChatRequest, LLMChatResult

logger = logging.getLogger(__name__)


class OpenAICompatibleClient:

    def __init__(
            self,
            api_key: str,
            base_url: str,
            provider: str,
            timeout_seconds: float

    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.provider = provider
        self.timeout_seconds = timeout_seconds

    async def chat(self, request: LLMChatRequest) -> LLMChatResult:
        # 组装 /chat/completions 请求体
        payload = {
            "model": request.model,
            "messages": [
                {"role": message.role, "content": message.content}
                for message in request.messages
            ],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens
        }

        logger.info(
            "LLM request provider=%s:\n%s",
            self.provider,
            format_log_json(payload),
        )

        # 向模型服务商发送 HTTP 请求
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )

        except httpx.HTTPError as exc:
            logger.exception(
                "LLM request failed provider=%s model=%s",
                self.provider,
                request.model,
            )
            raise AppException(
                message=f"LLM request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

        try:
            data = response.json()
            logger.info(
                "LLM response provider=%s status_code=%d:\n%s",
                self.provider,
                response.status_code,
                format_log_json(data),
            )
        except ValueError as exc:
            logger.error(
                "LLM response was not valid JSON provider=%s status_code=%d body=%s",
                self.provider,
                response.status_code,
                response.text,
            )
            if response.status_code < 400:
                raise AppException(
                    message="LLM provider returned invalid JSON",
                    code=502,
                    status_code=502,
                ) from exc
            data = None

        # 统一异常转换
        if response.status_code >= 400:
            raise AppException(
                message=f"LLM provider returned HTTP {response.status_code}",
                code=502,
                status_code=502,
            )

        # 解析 OpenAI 兼容响应结构
        if not isinstance(data, dict):
            raise AppException(
                message="LLM provider returned invalid response structure",
                code=502,
                status_code=502,
            )

        choices = data.get("choices") or []

        if (
            not isinstance(choices, list)
            or not choices
            or not isinstance(choices[0], dict)
        ):
            raise AppException(
                message="LLM provider returned empty choices",
                code=502,
                status_code=502,
            )

        message = choices[0].get("message") or {}
        if not isinstance(message, dict):
            raise AppException(
                message="LLM provider returned invalid message",
                code=502,
                status_code=502,
            )

        content = message.get("content")
        if not isinstance(content, str):
            raise AppException(
                message="LLM provider returned empty message content",
                code=502,
                status_code=502,
            )

        usage = data.get("usage")
        # 这里只取第一条回复，后续如果支持多候选结果，可以在这里扩展。
        return LLMChatResult(
            provider=request.provider,
            model=request.model,
            content=content,
            usage=usage if isinstance(usage, dict) else None,
        )
