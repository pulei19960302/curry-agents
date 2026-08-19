from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# BaseSettings 会把字段名转换成环境变量名. 总的一些环境配置
class Settings(BaseSettings):
    api_app_name: str = "CurryAgent API"
    api_env: str = "development"
    api_version: str = "0.1.0"
    api_prefix: str = "/api"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()