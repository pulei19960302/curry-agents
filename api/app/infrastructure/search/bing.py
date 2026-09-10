"""Bing Web Search 适配器。

    第 30 章先把搜索能力封装在这个 client 中。Agent 工具只依赖
    `search()` 方法，不直接知道 HTTP 地址、请求头和响应 JSON 结构。
    后续如果要换 Google、Tavily、SerpAPI 或自建搜索，只需要替换这一层。
    """

import httpx

from app.core.config import settings
from app.core.exceptions import AppException
from app.domain.search.entities import SearchResult, SearchResponse


class BingSearchClient:

    def __init__(
            self,
            api_key: str,
            endpoint: str,
            market: str,
            timeout_seconds: float
    ):
        self.api_key = api_key
        self.endpoint = endpoint.rstrip('/')
        self.market = market
        self.timeout_seconds = timeout_seconds

    def search(self, query: str, count: int) -> SearchResponse:
        """调用 Bing Web Search API，并转换成项目内统一结构。"""
        cleaned_query = query.strip()

        if not cleaned_query:
            raise AppException(
                message="search query is required",
                code=400,
                status_code=400,
            )
        # 2. 没有配置 API Key 时不直接崩溃，而是返回一条教学提示结果。
        #    这样暂时没有 Bing Key 的环境也能看到 SearchTool 的事件格式和前端展示效果。
        if not self.api_key:
            return SearchResponse(
                query=cleaned_query,
                provider="bing-disabled",
                items=[
                    SearchResult(
                        title="SearchTool 尚未配置 Bing API Key",
                        url="https://www.microsoft.com/bing/apis/bing-web-search-api",
                        snippet=(
                            "请在 .env 中配置 BING_SEARCH_API_KEY 后重新创建 API 容器。"
                            "配置完成后，SearchTool 会返回真实网页搜索结果。"
                        ),
                    )
                ],
            )

        try:
            # 3. Bing Web Search API 使用 Ocp-Apim-Subscription-Key 作为鉴权头。
            response = httpx.get(
                f"{self.endpoint}/v7.0/search",
                headers={"Ocp-Apim-Subscription-Key": self.api_key},
                params={
                    "q": cleaned_query,
                    "count": max(1, min(count, settings.search_max_results)),
                    "mkt": self.market,
                    "responseFilter": "Webpages",
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise AppException(
                message=f"bing search failed: HTTP {exc.response.status_code}",
                code=502,
                status_code=502,
            ) from exc
        except httpx.HTTPError as exc:
            raise AppException(
                message=f"bing search request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

        # 4. 把 Bing 原始 JSON 压成稳定结构，避免上层代码依赖供应商字段。
        payload = response.json()
        web_pages = payload.get("webPages", {})
        values = web_pages.get("value", [])
        items = [
            SearchResult(
                title=str(item.get("name") or ""),
                url=str(item.get("url") or ""),
                snippet=str(item.get("snippet") or ""),
            )
            for item in values
        ]

        return SearchResponse(
            query=cleaned_query,
            provider="bing",
            items=items,
        )


def build_bing_search_client() -> BingSearchClient:
    """从全局配置创建 BingSearchClient。"""

    return BingSearchClient(
        api_key=settings.bing_search_api_key,
        endpoint=settings.bing_search_endpoint,
        market=settings.bing_search_market,
        timeout_seconds=settings.search_timeout_seconds,
    )
