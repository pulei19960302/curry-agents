from dataclasses import dataclass


@dataclass(slots=True)
class ObservabilityCheck:
    """一条面向排查的诊断项。"""

    key: str  # 稳定标识，用来给前端列表设置 key。
    name: str  # 展示名称
    category: str  # 例如 core、agent、tooling
    description: str  # 说明这条诊断项排查什么
    command: str  # 可以复制执行的命令
    expected: str  # 正常情况下应该看到什么
