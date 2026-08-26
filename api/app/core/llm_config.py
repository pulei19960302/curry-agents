from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.exceptions import AppException


# 定义 YAML 中 llm 节点的数据结构
class LLMDefaults(BaseModel):
    default_provider: str
    default_model: str
    temperature: float = Field(ge=0, le=2)
    max_tokens: int = Field(gt=0)


# 定义每个模型服务商的连接配置
class LLMProviderConfig(BaseModel):
    base_url: str
    # 这里保存的是环境变量名称，不是真实密钥，避免把密钥写进配置文件。
    api_key_env: str
    timeout_seconds: float = Field(gt=0)


# 定义完整 LLM 配置文件结构
class LLMConfig(BaseModel):
    llm: LLMDefaults

    providers: dict[str, LLMProviderConfig]


# 读取 解析
# @lru_cache 表示配置加载后会缓存。这样每次请求不会重复读 YAML 文件
@lru_cache
def load_llm_config() -> LLMConfig:
    llm_config_path = Path(settings.llm_config_path)

    if not llm_config_path.is_file():
        raise AppException(
            message=f"LLM config file not found: {settings.llm_config_path}",
            code=500,
            status_code=500,
        )

    raw_config = yaml.safe_load(llm_config_path.read_text(encoding="utf-8")) or {}

    config = LLMConfig.model_validate(raw_config)
    # 默认 provider 必须能在 providers 中找到，否则后续聊天接口不知道该调用谁。
    if config.llm.default_provider not in config.providers:
        raise AppException(
            message="default LLM provider is not defined",
            code=500,
            status_code=500,
        )
    return config
