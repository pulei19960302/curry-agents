from typing import Any

from app.infrastructure.sandbox.base_client import SandboxBaseClient


class SandboxBrowserClient(SandboxBaseClient):
    """
        主 API 访问 Sandbox Browser API 的同步客户端。
        BrowserTool 不直接依赖 Playwright，只通过这个 client 调用 Sandbox。
        这样浏览器进程仍然被限制在隔离容器里。
    """

    # 浏览器会话状态和生命周期
    def status(self) -> dict[str, Any]:
        return self._request(method="GET", path="/browser/status")

    def start(self) -> dict[str, Any]:
        return self._request(method="GET", path="/browser/session")

    def close(self) -> dict[str, Any]:
        return self._request(method="DELETE", path="/browser/session")

    # 导航
    def navigate(self, url: str, wait_until: str = "domcontentloaded") -> dict[str, Any]:
        return self._request(
            method="POST",
            path="/browser/page/navigate",
            json={"url": url, "wait_until": wait_until}
        )

    # 获取当前页面信息
    def page_info(self) -> dict[str, Any]:
        return self._request(method="GET", path="/browser/page")

    # 截图
    def screenshot(self, full_page: bool = True) -> dict[str, Any]:
        return self._request(
            method="POST",
            path="/browser/page/screenshot",
            json={"full_page": full_page},
        )
