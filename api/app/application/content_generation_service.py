import json
import logging
from typing import Any

from app.application.llm_service import LLMService
from app.core.exceptions import AppException
from app.domain.llm.entities import LLMMessage

DEFAULT_MAX_TOKENS = 8_000
DEFAULT_TEMPERATURE = 0.2

logger = logging.getLogger(__name__)


class ContentGenerationService:
    """生成一些超长的回复"""

    def __init__(self, llm_service: LLMService | None = None):
        self.llm_service = llm_service or LLMService()

    async def generate_parameter(
            self,
            *,
            plan: dict[str, Any],
            step: dict[str, Any],
            tool_name: str,
            parameter_name: str,
            parameter_description: str,
            current_arguments: dict[str, Any] | None = None,
            agent_context: str = "",
            max_tokens: int = DEFAULT_MAX_TOKENS,
            temperature: float = DEFAULT_TEMPERATURE,
    ) -> str:
        self._validate_request(
            tool_name=tool_name,
            parameter_name=parameter_name,
            max_tokens=max_tokens,
        )

        prompt = self._build_prompt(
            plan=plan,
            step=step,
            tool_name=tool_name,
            parameter_name=parameter_name,
            parameter_description=parameter_description,
            current_arguments=current_arguments or {},
            agent_context=agent_context,
        )

        chunks: list[str] = []
        finish_reason: str | None = None

        async for chunk in self.llm_service.stream_chat(
                messages=self._build_messages(prompt),
                temperature=temperature,
                max_tokens=max_tokens,
        ):
            if chunk.content:
                chunks.append(chunk.content)

            if chunk.finish_reason is not None:
                finish_reason = chunk.finish_reason

        if finish_reason == "length":
            raise AppException(
                message=(
                    f"LLM streaming content was truncated for "
                    f"{tool_name}.{parameter_name}.{finish_reason}"
                ),
                code=502,
                status_code=502,
            )

        if finish_reason not in (None, "stop"):
            raise AppException(
                message=f"LLM content ended with finish_reason={finish_reason}",
                code=502,
                status_code=502,
            )

        content = "".join(chunks).strip()

        if not content:
            raise AppException(
                message=(
                    f"LLM returned empty content for "
                    f"{tool_name}.{parameter_name}"
                ),
                code=502,
                status_code=502,
            )

        logger.info(
            "llm result=%s",
            content,
        )

        return content

    @staticmethod
    def _build_prompt(
            *,
            plan: dict[str, Any],
            step: dict[str, Any],
            tool_name: str,
            parameter_name: str,
            parameter_description: str,
            current_arguments: dict[str, Any],
            agent_context: str,
    ) -> str:

        """构建这次模型输出内容相关的参数"""

        plan_goal = str(plan.get("goal") or "")

        # 步骤相关的
        step_title = str(step.get("title") or "")
        step_description = str(step.get("description") or "")
        expected_output = str(step.get("expected_output") or "")

        return (
            f"工具名：{tool_name}\n"
            f"待生成参数：{parameter_name}\n"
            f"参数说明：{parameter_description}\n"
            f"已有工具参数：{json.dumps(current_arguments, ensure_ascii=False)}\n\n"
            f"总体目标：{plan_goal}\n"
            f"当前步骤标题：{step_title}\n"
            f"当前步骤说明：{step_description}\n"
            f"预期输出：{expected_output}\n\n"
            f"相关上下文：{agent_context or '暂无额外上下文'}\n\n"
            "请生成待生成参数的完整内容。"
        )

    @staticmethod
    def _build_messages(prompt: str) -> list[LLMMessage]:
        return [
            LLMMessage(
                role="system",
                content=(
                    "你是 Agent 的内容生成器。"
                    "你只负责生成指定工具参数的内容，不负责选择工具。"
                    "只输出参数本身，不要输出 JSON、解释文字或 Markdown 代码块。"
                    "必须生成完整、可直接交给工具执行的内容。"
                ),
            ),
            LLMMessage(role="user", content=prompt),
        ]

    @staticmethod
    def _validate_request(
            *,
            tool_name: str,
            parameter_name: str,
            max_tokens: int,
    ) -> None:
        if not tool_name.strip():
            raise AppException(
                message="tool name is required for content generation",
                code=400,
                status_code=400,
            )

        if not parameter_name.strip():
            raise AppException(
                message="parameter name is required for content generation",
                code=400,
                status_code=400,
            )

        if max_tokens <= 0:
            raise AppException(
                message="max_tokens must be greater than zero",
                code=400,
                status_code=400,
            )
