from typing import Literal

from pydantic.dataclasses import dataclass

Severity = Literal["info", "warning", "risk"]


@dataclass(slots=True)
class SecurityCheck:
    """一条面向安全边界的检查项。"""
    key: str
    name: str
    category: str  # 分类，例如 configuration、sandbox、memory
    severity: Severity  # 风险等级，取值为 info、warning、risk
    risk: str  # 这条边界如果不处理，会发生什么问题
    recommendation: str  # 推荐怎么修复或收紧
    verify_command: str  # 可以复制执行的验证命令
