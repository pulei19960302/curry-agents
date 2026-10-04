"""OpenAI-compatible HTTP client for regular and streaming completions."""

import httpx
import json
import logging
from collections.abc import AsyncIterator

from app.core.exceptions import AppException
from app.core.logging import format_log_json
from app.domain.llm.entities import LLMChatRequest, LLMChatResult, LLMStreamChunk

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
        payload = self._build_payload(request)

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
        finish_reason = choices[0].get("finish_reason")
        # 这里只取第一条回复，后续如果支持多候选结果，可以在这里扩展。
        return LLMChatResult(
            provider=request.provider,
            model=request.model,
            content=content,
            usage=usage if isinstance(usage, dict) else None,
            finish_reason=(
                str(finish_reason)
                if finish_reason is not None
                else None
            ),
        )

    async def stream_chat(
            self,
            request: LLMChatRequest,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Stream chat-completion content from an OpenAI-compatible endpoint.

        The endpoint is expected to return Server-Sent Events in the standard
        format, for example ``data: {"choices": [...]}``, followed by
        ``data: [DONE]``. Providers that omit an empty terminal chunk are also
        supported.
        """

        payload = self._build_payload(request)
        payload["stream"] = True

        logger.info(
            "LLM streaming request provider=%s:\n%s",
            self.provider,
            format_log_json(payload),
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                            "Accept": "text/event-stream",
                        },
                        json=payload,
                ) as response:
                    if response.status_code >= 400:
                        body = (await response.aread()).decode(
                            "utf-8",
                            errors="replace",
                        )
                        logger.error(
                            "LLM streaming request failed provider=%s "
                            "status_code=%d body=%s",
                            self.provider,
                            response.status_code,
                            body,
                        )
                        raise AppException(
                            message=(
                                "LLM provider streaming request returned "
                                f"HTTP {response.status_code}"
                            ),
                            code=502,
                            status_code=502,
                        )

                    async for line in response.aiter_lines():
                        line = line.strip()

                        logger.info(
                            "llm stream line=%s",
                            line
                        )

                        if not line or not line.startswith("data:"):
                            continue

                        raw_data = line[len("data:"):].strip()
                        if raw_data == "[DONE]":
                            return

                        try:
                            data = json.loads(raw_data)
                        except json.JSONDecodeError as error:
                            raise AppException(
                                message="LLM provider returned invalid stream JSON",
                                code=502,
                                status_code=502,
                            ) from error

                        if not isinstance(data, dict):
                            continue

                        choices = data.get("choices") or []
                        if not isinstance(choices, list) or not choices:
                            # Some providers send usage-only terminal chunks.
                            usage = data.get("usage")
                            if isinstance(usage, dict):
                                yield LLMStreamChunk(usage=usage)
                            continue

                        choice = choices[0]
                        if not isinstance(choice, dict):
                            continue

                        delta = choice.get("delta") or {}
                        if not isinstance(delta, dict):
                            delta = {}

                        content = delta.get("content")
                        if not isinstance(content, str):
                            # Support a few compatible providers that use text
                            # instead of chat-completion delta.content.
                            content = choice.get("text")
                        if not isinstance(content, str):
                            content = ""

                        finish_reason = choice.get("finish_reason")
                        finish_reason_value = (
                            str(finish_reason)
                            if finish_reason is not None
                            else None
                        )
                        usage = data.get("usage")
                        usage_value = usage if isinstance(usage, dict) else None

                        if content or finish_reason_value or usage_value:
                            yield LLMStreamChunk(
                                content=content,
                                finish_reason=finish_reason_value,
                                usage=usage_value,
                            )

        except httpx.HTTPError as exc:
            logger.exception(
                "LLM streaming request failed provider=%s model=%s",
                self.provider,
                request.model,
            )
            raise AppException(
                message=f"LLM streaming request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

    @staticmethod
    def _build_payload(request: LLMChatRequest) -> dict:
        return {
            "model": request.model,
            "messages": [
                {"role": message.role, "content": message.content}
                for message in request.messages
            ],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
