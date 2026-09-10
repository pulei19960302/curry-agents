import json

from app.core.config import settings
from app.domain.agent_core.tools import ToolRegistry, AgentTool, ToolDefinition, ToolParameter
from app.domain.search.entities import SearchResponse
from app.infrastructure.search.bing import BingSearchClient, build_bing_search_client


def register_search_tools(
        registry: ToolRegistry,
        client: BingSearchClient | None = None,
) -> None:
    """
        把网页搜索能力注册成 Agent 可调用工具。

        SearchTool 不直接写会话事件。它只返回工具执行结果，
        ReActAgentService 会统一把结果包装成 `tool_called` 事件。
    """

    search_client = client or build_bing_search_client()

    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="search_web",
                description="搜索互联网公开网页，返回标题、链接和摘要。",
                parameters=[
                    ToolParameter(
                        name="query",
                        type="string",
                        description="搜索关键词或问题，例如 Python 3.12 release notes。",
                    ),
                    ToolParameter(
                        name="count",
                        type="integer",
                        description="返回结果数量，默认 5，最大值由 SEARCH_MAX_RESULTS 控制。",
                        required=False,
                    ),
                ]
            ),
            handler=lambda query, count=5: _format_search_response(
                search_client.search(query, _normalize_count(count))
            )
        )
    )


def _normalize_count(value: object) -> int:
    if isinstance(value, bool):
        count = 5
    elif isinstance(value, (int, float, str)):
        try:
            count = int(value)
        except ValueError:
            count = 5
    else:
        count = 5

    return max(1, min(count, settings.search_max_results))


def _format_search_response(data: SearchResponse) -> str:
    """把搜索结果格式化成前端可解析的 JSON 字符串。

    这里使用 `kind=search_results`，第 29 章的工具预览面板可以根据
    kind 判断应该显示图片、搜索结果、Shell 输出还是普通文本。
    """

    return json.dumps(
        {
            "kind": "search_results",
            "provider": data.provider,
            "query": data.query,
            "items": [
                {
                    "title": item.title,
                    "url": item.url,
                    "snippet": item.snippet,
                }
                for item in data.items
            ],
        },
        ensure_ascii=False,
    )
