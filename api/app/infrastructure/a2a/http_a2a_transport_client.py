import httpx
from typing import Any

from app.core.exceptions import AppException
from app.domain.a2a.entities import A2aTaskResult, A2aAgentCard, A2aCapability, A2aMessagePart, A2aTaskStep
from app.infrastructure.a2a.client import A2aTransportClient


class HttpA2ATransportClient(A2aTransportClient):
    """最小 HTTP A2A 客户端。

        本章先约定远程服务暴露两个 HTTP 接口：
        GET /agent-card 和 POST /message/send。
        后续如果接入更完整 A2A 协议，可以继续替换这里的传输细节。
        """

    def get_agent_card(self) -> A2aAgentCard:
        payload = self._request("GET", "/agent-card")

        # 2. 把远程响应里的 capabilities 转成领域对象。
        #    如果远程字段缺失，使用空字符串兜底，避免前端渲染崩掉。
        capabilities = [
            A2aCapability(
                name=str(item.get("name") or ""),
                description=str(item.get("description") or ""),
                example=str(item.get("example") or item.get("description") or ""),
            )
            for item in payload.get("capabilities", [])
            if isinstance(item, dict)
        ]

        # 3. 返回统一 Agent Card。
        #    远程没返回的基础字段，使用配置文件中的值补齐

        return A2aAgentCard(
            name=str(payload.get("name") or self.config.name),
            description=str(payload.get("description") or self.config.description),
            url=str(payload.get("url") or self.config.url),
            version=str(payload.get("version") or self.config.version),
            capabilities=capabilities,
            default_input_modes=list(payload.get("default_input_modes") or ["text"]),
            default_output_modes=list(payload.get("default_output_modes") or ["text"]),
        )

    def send_message(self, message: str) -> A2aTaskResult:

        payload = self._request("POST", "/message/send", json={"message": message})

        # 2. 解析远程输入输出消息。
        #    远程服务可能不返回 input_message，所以 fallback 使用本次发送的 message。
        input_message = self._message_parts_from_payload(payload.get("input_message"), message)
        output_message = self._message_parts_from_payload(payload.get("output_message"), "")

        # 3. 解析远程执行步骤。
        #    steps 会进入前端工具预览，帮助用户看到远程 Agent 做过哪些动作。
        steps = [
            A2aTaskStep(
                index=int(item.get("index") or index),
                action=str(item.get("action") or "remote_step"),
                detail=str(item.get("detail") or ""),
            )
            for index, item in enumerate(payload.get("steps", []), start=1)
            if isinstance(item, dict)
        ]

        # 4. 包装成统一任务结果。
        #    即使真实远程 Agent 字段不完整，主 API 也尽量返回稳定结构。
        return A2aTaskResult(
            agent_key=self.agent_key,
            remote_agent=str(payload.get("remote_agent") or self.config.name),
            task_id=str(payload.get("task_id") or f"a2a-task-{uuid.uuid4()}"),
            status=str(payload.get("status") or "completed"),
            input_message=input_message,
            output_message=output_message,
            steps=steps,
        )

    def _message_parts_from_payload(self, value: object, fallback: str) -> list[A2aMessagePart]:
        if not isinstance(value, list):
            return [A2aMessagePart(kind="text", text=fallback)] if fallback else []

        parts: list[A2aMessagePart] = []

        for item in value:
            if isinstance(item, dict):
                parts.append(
                    A2aMessagePart(
                        kind=str(item.get("kind") or item.get("type") or "text"),
                        text=str(item.get("text") or ""),
                    )
                )
        return parts

    def _request(
            self,
            method: str,
            path: str,
            json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        # 1. 根据配置里的 base url 拼出远程接口地址。

        url = f"{self.config.url.rstrip('/')}{path}"

        try:
            response = httpx.request(
                method,
                url,
                json=json,
                timeout=self.config.timeout_seconds,
            )
            # 3. 非 2xx 响应直接抛出，统一转成 AppException 给上层。
            response.raise_for_status()

        except httpx.HTTPError as e:
            raise AppException(
                message=f"A2A HTTP request failed: {e}",
                code=502,
                status_code=502,
            ) from e

        #   兼容两种响应格式：
        #   - 直接返回业务 JSON
        #   - 返回统一 ApiResponse，其中业务数据在 data 字段里
        payload = response.json()
        if isinstance(payload, dict) and "data" in payload and isinstance(payload["data"], dict):
            return payload["data"]
        return payload if isinstance(payload, dict) else {}
