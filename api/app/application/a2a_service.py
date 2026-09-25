from app.domain.a2a.entities import A2aRemoteAgentInfo, A2aAgentCard, A2aTaskResult
from app.infrastructure.a2a.a2a_client_manager import A2aClientManager


def build_a2a_client_manager() -> A2aClientManager:
    return A2aClientManager()


class A2aService:
    """
        真实 A2A 工具接入的应用服务。

        第 34 章只做概念演示；第 35 章开始，这个服务负责读取 A2A 配置、
        获取远程 Agent Card，并向远程 Agent 发送任务消息。
    """

    def __init__(self, manager: A2aClientManager | None = None) -> None:
        self.manager = manager or build_a2a_client_manager()

    def list_agents(self) -> list[A2aRemoteAgentInfo]:
        return self.manager.list_agents()

    def get_default_agent(self) -> str:
        return self.manager.config.a2a.default_agent

    def get_agent_card(self, agent_key: str | None = None) -> A2aAgentCard:
        """读取指定远程 Agent 的 Agent Card。"""

        # 1. agent_key 可以为空。为空时 manager 会使用配置里的默认 Agent。
        # 2. manager 负责选择 demo/http transport 并读取 Agent Card。
        return self.manager.get_agent_card(agent_key=agent_key)

    def send_message(self, agent_key: str | None, message: str) -> A2aTaskResult:
        """向远程 Agent 发送一条任务消息，并返回统一任务结果。"""

        # 1. Route 和 AgentTool 都会调用这个方法。
        # 2. 统一从这里进入 manager，避免两边各自实现一套远程调用逻辑。
        # 3. 返回 A2aTaskResult，供 API 响应或工具输出继续包装。
        return self.manager.send_message(agent_key=agent_key, message=message)
