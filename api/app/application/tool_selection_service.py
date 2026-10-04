from asyncio import to_thread

import json
import logging
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, unquote, urlparse

from app.application.llm_service import LLMService
from app.core.config import settings
from app.core.exceptions import AppException
from app.domain.agent_core.tools import ToolRegistry, ToolDefinition, AgentTool, ToolCallResult
from app.domain.llm.entities import LLMMessage

logger = logging.getLogger(__name__)

# URL 可能紧接在中文句子中，例如："访问 https://www.baidu.com，等待加载"。
# 因此不能只按空白分割；匹配到中文标点、空白或常见句末符号时就停止。
_URL_PATTERN = re.compile(
    r"(?:https?://|www\.)[^\s，。！？、()（）\[\]{}<>\"']+",
    re.IGNORECASE,
)
_LOCAL_HTML_PATTERN = re.compile(
    r"(?:/workspace/|\./|/)?[\w./-]+\.(?:html?|xhtml)\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class ToolSelectionDecision:
    """模型或 fallback 产出的工具选择结果。"""

    tool_name: str
    arguments: dict[str, Any]
    source: str
    observable_summary: str


class ModelToolSelectionService:
    """结合模型输出和确定性 fallback 选择工具。

        开始把工具选择从 ReActAgentService 中抽出来：
        1. 优先让模型基于工具 schema、任务、上下文输出结构化 tool call。
        2. 模型不可用或输出不合法时，回退到规则选择，保证课程本地可验证。
        3. 调用前修复缺失的常见参数，避免简单参数缺失导致整步失败。
    """

    def __init__(self, *, registry: ToolRegistry, llm_service: LLMService | None = None) -> None:
        self.registry = registry
        self.llm_service = llm_service or LLMService()

    # 为计划步骤挑选工具
    async def call_tool_for_step(
            self,
            *,
            plan: dict,
            step: dict,
            index: int,
            agent_context: str
    ) -> ToolSelectionDecision:
        """选择一个工具并返回已经补齐普通参数的选择结果。"""

        # 收集当前任务文本。工具选择必须优先看当前任务，避免长期记忆误触发工具。

        goal = str(plan.get("goal", ""))  # 计划的目标
        title = str(step.get("title", ""))  # 这里步骤的title
        description = str(step.get("description", ""))  # 步骤的描述
        expected_output = str(step.get("expected_output", ""))  # 预期输出

        step_text = f"{title} {description} {expected_output}".strip()
        task_text = f"{goal} {step_text}".strip()

        # 先尝试模型工具选择。选择失败时直接报错，避免静默执行错误工具。
        decision = await self._select_with_model(
            overall_goal=goal,
            current_step={
                "index": index,
                "title": title,
                "description": description,
                "expected_output": expected_output,
            },
            agent_context=agent_context,
        )

        if decision is None:
            raise AppException(
                code=400,
                message="LLM choose tool error",
                status_code=400
            )

        # 校验工具存在，并在调用前修复缺失的常见参数。
        tool = self.registry.get(decision.tool_name)

        arguments = self._repair_arguments(
            tool=tool,
            arguments=decision.arguments,
            task_text=task_text,
            agent_context=agent_context,
        )

        # 补充完善
        return ToolSelectionDecision(
            tool_name=decision.tool_name,
            source=decision.source,
            observable_summary=decision.observable_summary,
            arguments=arguments
        )

    async def execute_tool(
            self,
            *,
            tool_name: str,
            arguments: dict[str, Any],
    ) -> ToolCallResult:

        tool = self.registry.get(tool_name)

        repaired_arguments = self._repair_arguments(
            tool=tool,
            arguments=arguments,
            task_text="",
            agent_context="",
        )

        # 把同步、可能阻塞的函数放到线程池中执行，避免阻塞当前的异步事件循环。
        return await to_thread(
            tool.call,
            repaired_arguments,
        )

    # 让模型输出结构化 tool call
    async def _select_with_model(
            self,
            *,
            overall_goal: str,
            current_step: dict[str, Any],
            agent_context: str
    ) -> ToolSelectionDecision | None:
        """调用 LLM 选择工具；任何异常都交给 fallback。"""

        try:
            result = await self.llm_service.chat(
                messages=[
                    LLMMessage(
                        role="system",
                        content=(
                            "你是 Agent 的工具选择器。每次只能为当前步骤选择一个工具。"
                            "必须优先执行 current_step，overall_goal 只作为背景信息。"
                            "不要因为 overall_goal 中包含其他动作，"
                            "而提前执行其他步骤的工具。"
                            "请只返回 JSON，不要返回 Markdown。"
                            "只负责选择工具和填写普通参数。"
                            "标记为 generated_by_model=true 的参数"
                            "不要在本次 JSON 中生成具体内容。"
                            "系统会在工具执行前单独生成这些参数。"
                            "如果 current_step 要求打开本地 HTML 文件，"
                            f"browser_open 的 url 必须使用 file://"
                            f"{settings.sandbox_workspace_dir.rstrip('/')}/<相对路径>；"
                            f"没有明确文件名时默认使用 file://"
                            f"{settings.sandbox_workspace_dir.rstrip('/')}/index.html。"
                            "本地文件不能使用 https:// 或 http://。"
                            "JSON 格式："
                            '{"tool_name":"工具名","arguments":{},"observable_summary":"给用户看的简短说明"}'
                            "\n\n可用工具：\n"
                            f"{self._render_tool_schemas()}\n\n"
                            "总体目标：\n"
                            f"{overall_goal or '暂无总体目标'}\n\n"
                            "当前步骤：\n"
                            f"{json.dumps(current_step, ensure_ascii=False)}\n\n"
                            "压缩上下文：\n"
                            f"{agent_context or '暂无额外上下文'}\n\n"
                            "注意：不要输出隐藏推理，只输出可观察的工具选择结果。"
                        ),
                    ),
                    LLMMessage(
                        role="user",
                        content=(
                            "请只为下面的 current_step 选择一个工具。"
                            "总体目标中的其他动作由后续步骤处理。\n"
                            f"overall_goal={overall_goal}\n"
                            f"current_step={json.dumps(current_step, ensure_ascii=False)}"
                        ),
                    ),
                ],
                temperature=0.1,
                max_tokens=800,
            )
            payload = json.loads(self._strip_code_fence(result.content))

        except (AppException, json.JSONDecodeError, TypeError, ValueError) as error:
            logger.warning(
                "tool selection response could not be parsed: %s",
                error,
            )

            return None

        if not isinstance(payload, dict):
            return None
        tool_name = str(payload.get("tool_name") or "").strip()
        arguments = payload.get("arguments")
        if not tool_name or not isinstance(arguments, dict):
            return None

        logger.info(
            "LLM selected tool=%s",
            tool_name,
        )

        try:
            self.registry.get(tool_name)
        except AppException:
            return None

        return ToolSelectionDecision(
            tool_name=tool_name,
            arguments=arguments,
            source="model",
            observable_summary=str(payload.get("observable_summary") or ""),
        )

    # 根据规则来判断
    def _select_with_rules(
            self,
            *,
            task_text: str,
            step_text: str,
            index: int,
            agent_context: str,
    ) -> ToolSelectionDecision:
        """保留本地稳定可验证的规则选择逻辑。"""

        text_with_context = (
            f"{task_text}\n\n需要遵守的上下文：\n{agent_context}"
            if agent_context
            else task_text
        )

        if self._needs_multi_agent(task_text):
            return ToolSelectionDecision(
                tool_name="multi_agent_collaborate",
                arguments={"task": self._trim(text_with_context, 500)},
                source="fallback",
                observable_summary="使用多 Agent 协作完成任务。",
            )
        if self._needs_a2a(task_text):
            return ToolSelectionDecision(
                tool_name="a2a_call",
                arguments={
                    "agent_key": "demo_researcher",
                    "message": self._trim(text_with_context, 500),
                },
                source="fallback",
                observable_summary="调用远程 Agent 协作。",
            )
        if self._needs_mcp(task_text):
            return ToolSelectionDecision(
                tool_name="mcp_call",
                arguments={
                    "server_name": "demo",
                    "tool_name": "mcp_echo",
                    "arguments_json": '{"text":"来自 MCP 工具的演示响应"}',
                },
                source="fallback",
                observable_summary="调用 MCP 工具。",
            )
        if self._needs_search(task_text):
            return ToolSelectionDecision(
                tool_name="search_web",
                arguments={"query": self._extract_search_query(task_text), "count": 5},
                source="fallback",
                observable_summary="搜索公开网页资料。",
            )
        if self._needs_browser_screenshot(task_text):
            if index == 1 or (
                    self._needs_browser_open(step_text)
                    and not self._needs_browser_screenshot(step_text)
            ):
                return ToolSelectionDecision(
                    tool_name="browser_open",
                    arguments={"url": self._extract_url(task_text)},
                    source="fallback",
                    observable_summary="打开网页。",
                )
            return ToolSelectionDecision(
                tool_name="browser_screenshot",
                arguments={"full_page": True},
                source="fallback",
                observable_summary="截取浏览器页面。",
            )
        if self._needs_browser_open(task_text):
            return ToolSelectionDecision(
                tool_name="browser_open",
                arguments={"url": self._extract_url(task_text)},
                source="fallback",
                observable_summary="打开网页。",
            )
        if "关键" in task_text or "重点" in task_text:
            return ToolSelectionDecision(
                tool_name="extract_keywords",
                arguments={"text": text_with_context},
                source="fallback",
                observable_summary="提取关键词。",
            )
        if "拆" in task_text or "步骤" in task_text or "计划" in task_text:
            return ToolSelectionDecision(
                tool_name="draft_plan",
                arguments={"task": text_with_context},
                source="fallback",
                observable_summary="生成计划草稿。",
            )
        return ToolSelectionDecision(
            tool_name="summarize_text",
            arguments={"text": text_with_context},
            source="fallback",
            observable_summary="总结当前步骤。",
        )

    def _repair_arguments(
            self,
            *,
            tool: AgentTool,
            arguments: dict[str, Any],
            task_text: str,
            agent_context: str,
    ) -> dict[str, Any]:
        """在 AgentTool 校验前补齐可推断参数。"""
        repaired = dict(arguments)
        text_with_context = (
            f"{task_text}\n\n需要遵守的上下文：\n{agent_context}"
            if agent_context
            else task_text
        )
        for parameter in tool.definition.parameters:
            value = repaired.get(parameter.name)
            if not parameter.required or value not in (None, ""):
                continue

            if parameter.name in {"query", "q"}:
                repaired[parameter.name] = self._extract_search_query(task_text)
            elif parameter.name in {"text", "task", "message"}:
                repaired[parameter.name] = text_with_context
            elif parameter.name == "url":
                repaired[parameter.name] = self._extract_url(task_text)
            elif parameter.name == "server_name":
                repaired[parameter.name] = "demo"
            elif parameter.name == "tool_name":
                repaired[parameter.name] = "mcp_echo"
            elif parameter.name == "agent_key":
                repaired[parameter.name] = "demo_researcher"

        if tool.definition.name == "browser_open":
            repaired["url"] = self._normalize_browser_url(
                repaired.get("url"),
                task_text,
            )
        return repaired

    def _render_tool_schemas(self) -> str:
        lines: list[str] = []
        tools = self.registry.list_tools()

        for tool in tools:
            lines.append(self._render_tool_schema(tool))

        return "\n".join(lines)

    @staticmethod
    def _render_tool_schema(tool: ToolDefinition) -> str:
        parameters = [
            {
                "name": parameter.name,
                "type": parameter.type,
                "required": parameter.required,
                "description": parameter.description,
                "generated_by_model": parameter.generated_by_model
            }
            for parameter in tool.parameters
        ]
        return json.dumps(
            {
                "name": tool.name,
                "description": tool.description,
                "parameters": parameters,
            },
            ensure_ascii=False,
        )

    @staticmethod
    def _strip_code_fence(content: str) -> str:
        clean = content.strip()
        if clean.startswith("```"):
            clean = clean.strip("`")
            if clean.startswith("json"):
                clean = clean[4:]
        return clean.strip()

    # 固定规则 进行校验
    @staticmethod
    def _needs_browser_open(text: str) -> bool:
        return any(keyword in text for keyword in ["网页", "网站", "浏览器", "访问", "打开", "页面"])

    @staticmethod
    def _needs_search(text: str) -> bool:
        return any(keyword in text for keyword in ["搜索", "检索", "查找", "查询", "资料", "新闻", "最新"])

    @staticmethod
    def _needs_mcp(text: str) -> bool:
        return any(keyword in text for keyword in ["MCP", "mcp", "外部工具", "外部系统"])

    @staticmethod
    def _needs_a2a(text: str) -> bool:
        return any(keyword in text for keyword in ["A2A", "a2a", "远程 Agent", "远程agent", "远程智能体"])

    @staticmethod
    def _needs_multi_agent(text: str) -> bool:
        if any(keyword in text for keyword in ["A2A", "a2a", "远程 Agent", "远程智能体"]):
            return False
        return any(keyword in text for keyword in ["多 Agent", "多Agent", "分工", "协作", "评审", "汇总"])

    @staticmethod
    def _needs_browser_screenshot(text: str) -> bool:
        return any(keyword in text for keyword in ["截图", "截屏", "页面截图", "观察页面"])

    @staticmethod
    def _extract_url(text: str) -> str:
        """Extract a web URL or a local workspace file URL from task text.

                正则会从连续文本中提取第一个以 http/https 或 www. 开头的地址，并在
                中文标点、空白等边界停止。例如“访问 https://www.baidu.com，等待加载”
                会正确提取为 ``https://www.baidu.com``，不会把“等待加载”拼进域名。
                ``www.baidu.com`` 这类无协议地址会补为 ``https://www.baidu.com``。

                如果任务要求打开本地 HTML 文件，返回 Sandbox workspace 对应的
                ``file://<workspace>/...`` URL。只有普通网页任务没有 URL 时，才会
                回退到 ``https://example.com``。

                后续可让 LLM 在步骤 payload 中直接输出 url 字段，避免依赖字符串解析。
                """

        for match in _URL_PATTERN.finditer(text):
            # urlparse 只有看到协议时才会把主机名放进 netloc，因此为 www. 补充
            # https:// 后再校验，既支持 LLM 输出的完整 URL，也支持用户裸域名。
            # 英文句点和 ? 可能属于域名、路径或查询参数，正则不能把它们作为
            # 边界；仅在这里去掉 URL 结尾可能附带的英文句末标点。
            candidate = match.group().rstrip(".,!?")
            normalized_url = (
                candidate
                if candidate.lower().startswith(("http://", "https://"))
                else f"https://{candidate}"
            )
            parsed = urlparse(normalized_url)
            if parsed.scheme in {"http", "https"} and parsed.netloc:
                return normalized_url

        local_path = _LOCAL_HTML_PATTERN.search(text)
        if local_path:
            return ModelToolSelectionService._to_workspace_file_url(
                local_path.group()
            )

        if ModelToolSelectionService._needs_local_html(text):
            return ModelToolSelectionService._to_workspace_file_url("index.html")

        return "https://example.com"

    @staticmethod
    def _normalize_browser_url(value: Any, task_text: str) -> str:
        """Normalize browser_open arguments for remote and local pages."""

        if isinstance(value, str) and value.strip():
            clean_value = value.strip()
            if clean_value.startswith(("http://", "https://")):
                return clean_value

            if clean_value.startswith("file://"):
                file_path = unquote(urlparse(clean_value).path)
                return ModelToolSelectionService._to_workspace_file_url(file_path)

            if (
                    clean_value.lower().endswith((".html", ".htm", ".xhtml"))
                    or ModelToolSelectionService._needs_local_html(task_text)
            ):
                return ModelToolSelectionService._to_workspace_file_url(clean_value)

            return (
                clean_value
                if clean_value.lower().startswith("www.")
                else f"https://{clean_value}"
            )

        return ModelToolSelectionService._extract_url(task_text)

    @staticmethod
    def _to_workspace_file_url(path: str) -> str:
        clean_path = path.strip().replace("\\", "/")
        if clean_path.startswith("file://"):
            return clean_path

        workspace_dir = settings.sandbox_workspace_dir.rstrip("/") or "/"
        if clean_path.startswith(f"{workspace_dir}/"):
            relative_path = clean_path[len(workspace_dir) + 1:]
        elif clean_path.startswith("/workspace/"):
            # 兼容模型仍返回默认工作区路径的情况；最终 URL 使用当前配置。
            relative_path = clean_path[len("/workspace/"):]
        else:
            relative_path = clean_path.lstrip("/")

        relative_path = relative_path or "index.html"
        encoded_path = quote(relative_path, safe="/._-")
        return f"file://{workspace_dir}/{encoded_path}"

    @staticmethod
    def _needs_local_html(text: str) -> bool:
        lowered = text.lower()
        return any(
            keyword in lowered
            for keyword in (
                "本地文件",
                "本地网页",
                "本地页面",
                "本地 html",
                "本地html",
                "html 文件",
                "html文件",
                "html 页面",
                "html页面",
            )
        )

    @staticmethod
    def _extract_search_query(text: str) -> str:
        clean_text = " ".join(text.split())
        for keyword in ["搜索", "检索", "查找", "查询", "一下", "资料"]:
            clean_text = clean_text.replace(keyword, " ")
        return " ".join(clean_text.split())[:120] or text[:120]

    @staticmethod
    def _trim(value: str, limit: int) -> str:
        clean = " ".join(value.split())
        return clean[:limit]
