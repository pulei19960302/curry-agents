from dataclasses import dataclass


# 最小的消息结构
@dataclass(slots=True)
class LLMMessage:
    role: str
    content: str


# 定义一次模型调用需要的完整参数
@dataclass(slots=True)
class LLMChatRequest:
    messages: list[LLMMessage]
    model: str
    provider: str
    temperature: float
    max_tokens: int


# 定义模型调用完成后的统一结果
@dataclass(slots=True)
class LLMChatResult:
    provider: str
    model: str
    content: str
    usage: dict | None = None
