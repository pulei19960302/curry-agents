from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True)
class ContextMessage:
    role: str
    content: str  # 已经处理过的消息内容。它可能是原文，也可能是裁剪后的文本
    original_chars: int  # 保留原始长度，方便判断内容被裁剪了多少。
    truncated: bool  # 标记 content 是否已经按上下文预算裁剪。
    created_at: datetime


# 事件摘要 事件表可能有很多条 step_started、tool_called，上下文里不一定需要每一条的完整 payload，所以先按类型聚合。
@dataclass(slots=True)
class ContextEventSummary:
    type: str
    count: int  # 同类型事件在最近事件窗口里出现了多少次。
    latest_at: datetime  # 这个事件类型最近一次出现的时间。


# 文件引用。文件内容可能很长，本章只把文件名、类型、大小和使用提示放进上下文。
@dataclass(slots=True)
class ContextFileReference:
    id: UUID
    name: str
    content_type: str
    size: int
    usage_hint: str  # 告诉 Agent 这个文件应该被读取、下载，还是只作为引用保留


# 预算报告。它告诉页面本次纳入了多少消息，省略了多少消息，纳入了多少事件，省略了多少事件
@dataclass(slots=True)
class ContextBudget:
    message_limit: int  # 配置允许纳入的最大消息条数。
    event_limit: int  # 配置允许参考的最大事件条数。
    max_message_chars: int  # 单条消息允许保留的最大字符数。
    included_messages: int  # 本次快照实际纳入的消息条数。
    omitted_messages: int  # 因预算限制被省略的历史消息条数。
    included_events: int  # 本次快照参考的最近事件数量。
    omitted_events: int  # 因预算限制被省略的历史事件数量。
    total_message_chars: int  # 裁剪后消息内容的总字符数。


# session 上下文快照
@dataclass(slots=True)
class SessionContextSnapshot:
    session_id: UUID
    summary: str
    messages: list[ContextMessage]
    event_summaries: list[ContextEventSummary]
    files: list[ContextFileReference]
    budget: ContextBudget
