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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
