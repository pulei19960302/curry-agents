import re
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup, Tag

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
            return self._search_bing_page(cleaned_query, count)

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
                timeout=self.timeout_seconds,
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

    # 无 API Key 时使用网页搜索降级
    def _search_bing_page(self, query: str, count: int) -> SearchResponse:
        """
            请求 Bing 搜索页，并从 HTML 中解析自然搜索结果。
            这个方法不是生产环境的首选方案，因为搜索页 DOM 可能变化。
            但它非常适合课程和本地开发：没有 API key 时，SearchTool 仍然能
            产生真实搜索结果，前端也能看到完整工具调用过程。
        """
        try:
            response = httpx.get(
                "https://www.bing.com/search",
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Accept-Encoding": "gzip, deflate",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                },
                params={"q": query, "mkt": self.market},
                timeout=self.timeout_seconds,
                follow_redirects=True,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise AppException(
                message=f"bing page search request failed: {exc}",
                code=502,
                status_code=502,
            ) from exc

        if self._is_bing_challenge_page(response.text):
            raise AppException(
                message="bing page search returned a verification page",
                code=502,
                status_code=502,
            )

        items = self._parse_bing_results(html=response.text)
        max_count = max(1, min(count, settings.search_max_results))

        return SearchResponse(
            query=query,
            provider="bing-page",
            items=items[:max_count],
        )

    def _parse_bing_results(self, html: str) -> list[SearchResult]:
        """从 Bing 搜索结果页中解析自然结果。

        Bing 搜索页不是稳定 API，页面结构可能因为地区、登录状态或 A/B
        实验变化。这里参考真实 Agent 项目常用做法，不只依赖单一 DOM
        路径，而是按“结果块 -> 标题链接 -> 摘要文本”的顺序做多层兜底。
        """

        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []

        # ===================== 第1步：定位 Bing 自然搜索结果块 =====================
        # 常规结果一般在 li.b_algo 中。这里保留 CSS 选择器，后续如果 Bing
        # DOM 变化，只需要补充选择器，不影响上层 SearchTool。
        for item in soup.select("li.b_algo"):
            if not isinstance(item, Tag):
                continue

            # ===================== 第2步：提取标题和链接 =====================
            # 首选 h2 > a，这是 Bing 自然结果最常见结构。
            title = ""
            url = ""
            title_link = item.select_one("h2 a")
            if isinstance(title_link, Tag):
                title = self._clean_text(title_link.get_text(" ", strip=True))
                url = str(title_link.get("href") or "")

            # 如果 h2 缺失，退化为寻找结果块中第一个“像标题”的链接。
            # 这能覆盖部分特殊卡片或区域差异导致的结构变化。
            if not title:
                for link in item.find_all("a"):
                    if not isinstance(link, Tag):
                        continue
                    text = self._clean_text(link.get_text(" ", strip=True))
                    href = str(link.get("href") or "")
                    if len(text) > 10 and href:
                        title = text
                        url = href
                        break

            if not title or not url:
                continue

            # 提取摘要
            # Bing 的摘要可能在 p、b_caption、b_descript、b_lineclamp 等位置。
            snippet = self._extract_snippet(item, title)
            results.append(
                SearchResult(
                    title=title,
                    url=self._normalize_bing_url(url),
                    snippet=snippet,
                )
            )

        return results

    @staticmethod
    def _is_bing_challenge_page(html: str) -> bool:
        """判断 Bing 是否返回验证码或验证页面。"""

        lower_html = html.lower()
        # 验证码标识
        return (
                "captcha" in lower_html
                or "unusual traffic" in lower_html
                or "verify you are a human" in lower_html
                or "#bmc_container" in lower_html
        )

    def _extract_snippet(self, item: Tag, title: str) -> str:
        """从一个搜索结果块中提取摘要文本。"""

        # 1. 优先找 Bing 常见的摘要容器。
        snippet_selector = (
            ".b_caption p, .b_caption, .b_descript, .b_lineclamp, p"
        )
        for node in item.select(snippet_selector):
            text = self._clean_text(node.get_text(" ", strip=True))
            if len(text) > 20 and text != title:
                return text

        # 2. 如果没有标准摘要，就从整个结果块文本中切出较长句子。
        #    这样可以覆盖摘要被放进普通 div 的页面结构。
        all_text = self._clean_text(item.get_text(" ", strip=True))
        for sentence in re.split(r"[.!?\n。！？]", all_text):
            clean_sentence = self._clean_text(sentence)
            if len(clean_sentence) > 20 and clean_sentence != title:
                return clean_sentence

        return ""

    @staticmethod
    def _normalize_bing_url(value: str) -> str:
        """补全 Bing 搜索页中的相对链接或协议相对链接。"""

        clean_value = value.strip()
        if clean_value.startswith("//"):
            return f"https:{clean_value}"
        return urljoin("https://www.bing.com", clean_value)

    @staticmethod
    def _clean_text(value: str) -> str:
        """压缩空白字符，避免前端摘要出现奇怪换行。"""

        return re.sub(r"\s+", " ", value).strip()


def build_bing_search_client() -> BingSearchClient:
    """从全局配置创建 BingSearchClient。"""

    return BingSearchClient(
        api_key=settings.bing_search_api_key,
        endpoint=settings.bing_search_endpoint,
        market=settings.bing_search_market,
        timeout_seconds=settings.search_timeout_seconds,
    )
