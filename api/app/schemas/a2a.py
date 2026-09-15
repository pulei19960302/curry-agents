from pydantic import Field

from app.schemas.common import ResponseSchema


class A2aRoleResponse(ResponseSchema):
    name: str  # Host Agent、Remote Agent、Agent Card 或 Task。
    responsibility: str  # 这个角色在 A2A 协作中负责什么。
    curry_agent_mapping: str  # 在当前项目中会落到哪里。


class A2aCapabilityResponse(ResponseSchema):
    name: str  # 远程 Agent 声明的能力名。
    description: str  # 这项能力解决什么问题。
    example: str  # 一个便于理解的调用示例。


class A2aAgentCardResponse(ResponseSchema):
    name: str  # 远程 Agent 名称。
    description: str  # 远程 Agent 的职责说明。
    url: str  # 远程 Agent 的服务地址；第 34 章只是示例。
    version: str  # Agent Card 版本。
    capabilities: list[A2aCapabilityResponse]  # 远程 Agent 对外声明的能力。
    default_input_modes: list[str]  # 默认支持的输入格式。
    default_output_modes: list[str]  # 默认支持的输出格式。


class A2aConceptsResponse(ResponseSchema):
    roles: list[A2aRoleResponse]
    protocol: str  # 第 34 章只说明协议定位。
    next_step: str  # 告诉读者第 35 章会做真实工具接入。


class A2aMessageSendRequest(ResponseSchema):
    message: str = Field(min_length=1, max_length=4000)


class A2aMessagePartResponse(ResponseSchema):
    kind: str  # text、file、data 等；本章只用 text。
    text: str  # 文本内容。


class A2aTaskStepResponse(ResponseSchema):
    index: int  # 调用流程中的步骤序号。
    action: str  # 例如 read_agent_card、message/send。
    detail: str  # 对这一步的解释。


class A2aMessageDemoResponse(ResponseSchema):
    remote_agent: str  # 本次模拟调用选择的远程 Agent。
    task_id: str  # 模拟 A2A task ID。
    status: str  # completed、running、failed 等状态；本章固定 completed。
    input_message: list[A2aMessagePartResponse]
    output_message: list[A2aMessagePartResponse]
    steps: list[A2aTaskStepResponse]
