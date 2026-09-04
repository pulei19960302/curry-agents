from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# BaseSettings 会把字段名转换成环境变量名. 总的一些环境配置
class Settings(BaseSettings):
    api_app_name: str = "CurryAgent API"
    api_env: str = "development"
    api_version: str = "0.1.0"
    api_prefix: str = "/api"
    # 允许哪些前端地址访问 API。
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # 是否允许携带 Cookie 或认证信息。
    cors_allow_credentials: bool = True

    # 允许那些http 方法
    cors_allow_methods: list[str] = ["*"]

    # 允许哪些请求头。
    cors_allow_headers: list[str] = ["*"]

    # 日志级别
    log_level: str = "INFO"

    # 数据库配置 postgresql+asyncpg://用户名:密码@主机:端口/数据库名
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/curry_agents"
    )

    database_echo: bool = True

    # 上传文件配置
    upload_dir: str = "uploads"
    # 最大10m
    upload_max_size: int = 10 * 1024 * 1024

    # 预览最大
    file_preview_max_size: int = 64 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 上传文件配置
    file_storage_backend: str = "local"

    # llm 配置
    llm_config_path: str = "config/llm.yaml"

    # redis_task 相关配置
    redis_url: str = "redis://127.0.0.1:6379/0"
    agent_task_stream: str = "agent:tasks"
    agent_task_poll_timeout_ms: int = 1000

    # 上下文相关配置

    # 表示最多放多少条最近消息。
    context_message_limit: int = 8
    # 表示最多参考多少条最近事件。注意，这里不是把事件原样返回给模型，而是先取最近事件，再按类型压缩成摘要。
    context_event_limit: int = 20
    # 表示单条消息最多保留多少字符。用户可能粘贴很长内容，如果不裁剪，一条消息就可能占满上下文。
    context_max_message_chars: int = 1200

    # 沙箱容器api相关
    sandbox_api_base_url: str = "http://localhost:8100/api"
    sandbox_api_timeout_seconds: float = 10.0


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
