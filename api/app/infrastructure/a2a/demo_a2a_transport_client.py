import uuid

from app.core.exceptions import AppException
from app.domain.a2a.entities import A2aAgentCard, A2aTaskResult, A2aCapability, A2aMessagePart, A2aTaskStep
from app.infrastructure.a2a.client import A2aTransportClient


class DemoA2aTransportClient(A2aTransportClient):
    """内置 A2A 演示客户端。

        它模拟真实远程 Agent 的 Agent Card 和 message/send 响应，
        不需要额外启动服务，适合课程稳定验证完整工具事件链路。
    """

    def send_message(self, message: str) -> A2aTaskResult:
        # 清理用户任务文本。远程 Agent 不应该收到空消息。

        cleaned_message = message.strip()

        if not cleaned_message:
            raise AppException(
                message="A2A message is required",
                code=400,
                status_code=400,
            )
            # 2. 为本次远程调用生成一个模拟 task_id。
            #    真实 A2A 服务通常会返回自己的任务 ID，本章用 uuid 模拟。
        task_id = f"a2a-task-{uuid.uuid4()}"

        return A2aTaskResult(
            agent_key=self.agent_key,
            remote_agent=self.config.name,
            task_id=task_id,
            status="completed",
            input_message=[A2aMessagePart(kind="text", text=cleaned_message)],
            output_message=[
                A2aMessagePart(
                    kind="text",
                    text=(
                        f"{self.config.name} 已完成远程协作："
                        f"围绕“{cleaned_message}”整理了摘要、关键点和下一步建议。"
                    ),
                )
            ],
            steps=[
                A2aTaskStep(
                    index=1,
                    action="agent_card/read",
                    detail=f"读取远程 Agent Card：{self.config.name}。",
                ),
                A2aTaskStep(
                    index=2,
                    action="message/send",
                    detail="Host Agent 把用户任务包装成 A2A message 并发送。",
                ),
                A2aTaskStep(
                    index=3,
                    action="task/completed",
                    detail="远程 Agent 返回 completed 状态和输出消息。",
                ),
            ],
        )

    def get_agent_card(self) -> A2aAgentCard:
        # 1. demo transport 不发网络请求，直接把配置转换成 Agent Card。
        #    这样本地环境不用启动远程服务，也能跑通 Host 读取 Agent Card 的流程。
        return A2aAgentCard(
            name=self.config.name,
            description=self.config.description,
            url=self.config.url,
            version=self.config.version,
            capabilities=[
                A2aCapability(
                    name=capability.name,
                    description=capability.description,
                    example=capability.description,
                )
                for capability in self.config.capabilities
            ],
            default_input_modes=["text"],
            default_output_modes=["text"],
        )
