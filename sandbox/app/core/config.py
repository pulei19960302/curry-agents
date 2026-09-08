from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# 沙箱部分配置
class Settings(BaseSettings):
    #  基础服务信息：用于 /api/status 和接口文档 
    sandbox_app_name: str = "CurryAgent Sandbox"
    sandbox_env: str = "development"
    sandbox_version: str = "0.1.0"
    sandbox_api_prefix: str = "/api"
    log_level: str = "INFO"

    #  沙箱工作目录：后续文件、Shell、浏览器下载都限制在这里 
    workspace_dir: str = "/workspace"

    #  Supervisor：本章先固定接口形状，后续再接真实进程管理 
    supervisor_enabled: bool = False  # 是否启用真实 Supervisor 查询
    supervisor_services: list[str] = ["sandbox-api"]  # 希望沙箱管理的服务名列表。本章先放 sandbox-api

    # 文件上传下载
    max_file_read_bytes: int = 64 * 1024  # 读取文件时最多返回多少字节，避免一次读取超大文件
    max_file_write_bytes: int = 512 * 1024  # 写文件最大字节
    max_upload_size: int = 10 * 1024 * 1024  # 上传最大

    # shell 相关
    shell_output_limit: int = 64 * 1024
    shell_default_timeout_seconds: float = 10.0

    # Browser / CDP：先用 Playwright 启动一个 headless Chromium
    browser_enabled: bool = True  # 是否启用浏览器能力。生产环境可以通过它临时关闭浏览器
    browser_headless: bool = True  # 是否使用无头浏览器。本章默认 true，第 28 章接 VNC 时会继续扩展
    browser_viewport_width: int = 1280  # 浏览器视口宽度，影响截图尺寸和后续元素坐标
    browser_viewport_height: int = 720  # 浏览器视口高度，影响截图尺寸和后续元素坐标
    browser_default_timeout_ms: int = 15_000  # 页面操作默认超时时间，避免网页一直加载导致请求卡住
    browser_screenshot_full_page: bool = True  # 截图时是否默认截完整页面

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    # 配置对象只创建一次，避免每次请求都重新解析环境变量。
    return Settings()


settings = get_settings()
