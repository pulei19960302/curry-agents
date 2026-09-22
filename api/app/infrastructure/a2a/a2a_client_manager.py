from app.core.a2a_config import load_a2a_config, A2aAgentConfig
from app.core.exceptions import AppException
from app.domain.a2a.entities import A2aRemoteAgentInfo, A2aCapability, A2aAgentCard, A2aTaskResult
from app.infrastructure.a2a.client import A2aTransportClient
from app.infrastructure.a2a.demo_a2a_transport_client import DemoA2aTransportClient
from app.infrastructure.a2a.http_a2a_transport_client import HttpA2ATransportClient


class A2aClientManager:
    """
        A2A Client 管理器。

        它读取 A2A 配置，按 agent_key 创建对应传输客户端，
        并向应用服务提供统一的 list / card / message 调用方法。
    """

    def __init__(self) -> None:
        #    load_a2a_config 本身带 lru_cache，所以多次创建 manager 不会重复读文件。
        self.config = load_a2a_config()

    def list_agents(self) -> list[A2aRemoteAgentInfo]:
        """返回全部配置过的远程 Agent。"""

        return [
            A2aRemoteAgentInfo(
                key=key,
                enabled=agent.enabled,
                transport=agent.transport,
                name=agent.name,
                description=agent.description,
                url=agent.url,
                version=agent.version,
                capabilities=[
                    A2aCapability(
                        name=capability.name,
                        description=capability.description,
                        example=capability.description,
                    )
                    for capability in agent.capabilities
                ]
            )
            for key, agent in self.config.agents.items()
        ]

    def get_agent_card(self, agent_key: str | None = None) -> A2aAgentCard:
        """读取指定远程 Agent 的 Agent Card。"""
        key = agent_key or self.config.a2a.default_agent

        # 2. 校验 Agent 是否存在且启用，避免调用被禁用的外部服务。
        agent = self._get_enabled_agent(key)

        # 3. 根据 transport 创建 client，并读取 Agent Card。
        return self._build_transport(key, agent).get_agent_card()

    def send_message(self, message: str, agent_key: str | None = None) -> A2aTaskResult:
        """向指定远程 Agent 发送一条任务消息。"""

        # 1. 没有指定 agent_key 时使用默认远程 Agent。
        key = agent_key or self.config.a2a.default_agent

        # 2. 先校验配置状态，再创建对应 transport。
        agent = self._get_enabled_agent(key)

        # 3. 真正调用远程 Agent，并返回统一任务结果。
        return self._build_transport(key, agent).send_message(message)

    # 获取agent的辅助方法
    def _get_enabled_agent(self, agent_key: str) -> A2aAgentConfig:
        # 检查配置中是否存在这个 Agent。
        agent = self.config.agents.get(agent_key)

        if agent is None:
            raise AppException(
                message=f"A2A agent not found: {agent_key}",
                code=404,
                status_code=404,
            )

        if not agent.enabled:
            raise AppException(
                message=f"A2A agent is disabled: {agent_key}",
                code=400,
                status_code=400,
            )

        return agent

    @staticmethod
    def _build_transport(agent_key: str, agent: A2aAgentConfig) -> A2aTransportClient:
        # 1. demo transport 走内置模拟器，适合课程稳定验证。
        if agent.transport == "demo":
            return DemoA2aTransportClient(agent_key, agent)

        # 2. http transport 走真实远程 Agent 服务。
        if agent.transport == "http":
            return HttpA2ATransportClient(agent_key, agent)

        # 3. 配置里出现未知 transport 时返回明确错误。
        raise AppException(
            message=f"unsupported A2A transport: {agent.transport}",
            code=500,
            status_code=500,
        )
