import json

from app.application.multi_agent_service import MultiAgentService
from app.domain.agent_core.tools import ToolRegistry, AgentTool, ToolDefinition, ToolParameter
from app.domain.multi_agent.entities import MultiAgentRunResult


def register_multi_agent_tools(
        registry: ToolRegistry,
        service: MultiAgentService | None = None,
) -> None:
    """把多 Agent 协作编排注册成 AgentTool。"""

    # 1. 创建或复用多 Agent 应用服务。
    #    测试可以注入 fake service，正常运行时使用内置确定性编排。
    multi_agent_service = service or MultiAgentService()

    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="multi_agent_collaborate",
                description="让 Manager、Worker、Reviewer 多个 Agent 围绕一个任务协作。",
                parameters=[
                    ToolParameter(
                        name="task",
                        type="string",
                        description="需要多个 Agent 分工协作完成的任务。",
                    ),
                ],
            ),
            handler=lambda task: _format_multi_agent_result(
                multi_agent_service.run_collaboration(task=str(task)),
            )
        )
    )


def _format_multi_agent_result(result: MultiAgentRunResult) -> str:
    """把多 Agent 协作结果格式化成前端工具预览可识别的 JSON。"""

    # 1. ToolCallResult.output 当前是字符串，所以结构化结果需要序列化。
    # 2. kind 是前端选择预览卡片的分流字段。
    # 3. subtasks/review/final_answer 都保留，方便用户观察协作全过程。

    return json.dumps({
        "kind": result.kind,
        "task": result.task,
        "manager": result.manager,
        "roles": [
            {
                "key": role.key,
                "name": role.name,
                "responsibility": role.responsibility,
                "capability": role.capability,
            }
            for role in result.roles
        ],
        "subtasks": [
            {
                "id": subtask.id,
                "assignee": subtask.assignee,
                "title": subtask.title,
                "instruction": subtask.instruction,
                "expected_output": subtask.expected_output,
                "status": subtask.status,
                "output": subtask.output,
            }
            for subtask in result.subtasks
        ],
        "review": {
            "reviewer": result.review.reviewer,
            "status": result.review.status,
            "comments": result.review.comments,
            "improvement": result.review.improvement,
        },
        "final_answer": result.final_answer,
    },
        ensure_ascii=False
    )
