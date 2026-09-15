from dataclasses import dataclass


@dataclass(slots=True)
class A2aRole:
    """A2A 协议中的一个角色。

        第 34 章先用领域对象解释协议概念，不直接调用远程 Agent。
        name 是角色名称，responsibility 描述它负责什么，
        curry_agent_mapping 帮助读者理解它在当前项目中会落到哪里。
    """

    name: str
    responsibility: str
    curry_agent_mapping: str


@dataclass(slots=True)
class A2aCapability:
    """远程 Agent 对外声明的一项能力。"""

    name: str
    description: str
    example: str


@dataclass(slots=True)
class A2aAgentCard:
    """
        A2A Agent Card 的最小领域模型。
        Agent Card 类似远程 Agent 的名片。Host 在真正发送任务前，
        会先读取它来判断这个 Agent 是谁、能做什么、应该怎么调用。
    """

    name: str
    description: str
    url: str
    version: str
    capabilities: list[A2aCapability]
    default_input_modes: list[str]
    default_output_modes: list[str]


@dataclass(slots=True)
class A2aMessagePart:
    """
        A2A message 中的一段内容。
        A2A 的消息可以包含多种 part。第 34 章先使用 text，
        后续接文件、artifact 或更复杂内容时再扩展。
    """
    kind: str
    text: str


@dataclass(slots=True)
class A2aTaskStep:
    """模拟一次 A2A 调用中的可观察步骤。"""

    index: int
    action: str
    detail: str


@dataclass(slots=True)
class A2aMessageDemo:
    """第 34 章模拟 message/send 的返回结果。"""

    remote_agent: str
    task_id: str
    status: str
    input_message: list[A2aMessagePart]
    output_message: list[A2aMessagePart]
    steps: list[A2aTaskStep]
