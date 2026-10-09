from dataclasses import dataclass, field


@dataclass(slots=True)
class SettingsModule:
    key: str
    name: str
    description: str
    enabled: bool
    default_item: str | None = None
    items: list[dict[str, object]] = field(default_factory=list)
    status: str = "ready"  # 模块健康状态，例如 ready 或 warning
    status_message: str = ""  # 解释为什么可用或为什么需要处理
    source: str = ""  # 配置来自哪里，例如 .env、config/llm.yaml
    verify_command: str = ""  # 用户可以直接复制执行的验证命令


@dataclass(slots=True)
class SettingsIntegration:
    """设置页中由用户临时新增的一条集成记录。"""

    id: str
    kind: str
    name: str
    description: str
    endpoint: str | None
    enabled: bool


@dataclass(slots=True)
class AppSettingsSnapshot:
    """设置页一次性需要展示的配置快照。"""

    modules: list[SettingsModule]
    integrations: list[SettingsIntegration]
