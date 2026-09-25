from dataclasses import dataclass, field


@dataclass(slots=True)
class SettingsModule:
    key: str
    name: str
    description: str
    enabled: bool
    default_item: str | None = None
    items: list[dict[str, object]] = field(default_factory=list)


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
