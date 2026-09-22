from abc import ABC, abstractmethod

from app.core.a2a_config import A2aAgentConfig
from app.domain.a2a.entities import A2aAgentCard, A2aTaskResult


class A2aTransportClient(ABC):
    """
        A2A 传输层客户端基类。
        上层应用服务只关心“列出 Agent Card”和“发送任务消息”。
        具体是内置 demo、HTTP 远程服务，还是后续更完整的 A2A SDK，
        都封装在 transport client 中。
    """

    def __init__(self, agent_key: str, config: A2aAgentConfig) -> None:
        self.agent_key = agent_key
        self.config = config

    @abstractmethod
    def get_agent_card(self) -> A2aAgentCard:
        """读取远程 Agent Card。"""

    @abstractmethod
    def send_message(self, message: str) -> A2aTaskResult:
        """向远程 Agent 发送一条任务消息。"""
