# 定义工具协议
from dataclasses import dataclass
from inspect import signature
from typing import Any, Callable, get_type_hints

from app.core.exceptions import AppException


# 工具参数
@dataclass(slots=True)
class ToolParameter:
    """工具参数 schema。

        name 是参数名，type 是参数类型，description 用来给模型或前端解释参数含义。
    """
    name: str

    type: str

    description: str

    required: bool = True


# 定义工具描述结构
@dataclass(slots=True)
class ToolDefinition:
    """一个可以被 Agent 调用的工具。"""

    #  名字
    name: str

    # 描述
    description: str

    # 参数
    parameters: list[ToolParameter]


# 工具调用结果
@dataclass(slots=True)
class ToolCallResult:
    """工具调用后的统一结果。"""

    tool_name: str
    arguments: dict[str, Any]
    output: str


# 封装真实 Python 函数和工具 schema
@dataclass(slots=True)
class AgentTool:
    """工具对象 definition 给前端和模型看，handler 是后端真正执行的 Python 函数。"""

    definition: ToolDefinition

    # ...：参数类型和参数数量不限。
    # str：调用后必须返回字符串。
    handler: Callable[..., str]

    # 执行工具函数，并包装成统一结果。
    def call(self, arguments: dict[str, Any]) -> ToolCallResult:

        checked_arguments = self._validate_arguments(arguments)
        output = self.handler(**checked_arguments)

        return ToolCallResult(
            tool_name=self.definition.name,
            output=output,
            arguments=checked_arguments,
        )

    # 根据工具参数 schema 做最小校验
    def _validate_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
        checked: dict[str, Any] = {}

        for parameter in self.definition.parameters:
            value = arguments.get(parameter.name)
            # 如果参数必填且 value不是None 和""
            if parameter.required and value in (None, ""):
                raise AppException(
                    message=f"tool argument is required: {parameter.name}",
                    code=400,
                    status_code=400,
                )
            checked[parameter.name] = value
        return arguments


class ToolRegistry:
    """保存所有可用工具，并按名称查找工具。"""

    def __init__(self) -> None:
        self._tools: dict[str, AgentTool] = {}

    def register(self, tool: AgentTool) -> None:
        if tool.definition.name in self._tools:
            raise AppException(
                message=f"tool already exists: {tool.definition.name}",
                code=500,
                status_code=500,
            )

        self._tools[tool.definition.name] = tool

    # 获取全部工具
    def list_tools(self) -> list[ToolDefinition]:
        return [tool.definition for tool in self._tools.values()]

    # 获取某一个工具
    def get(self, name: str) -> AgentTool:
        """按名称获取工具，不存在时返回清晰错误。"""

        tool = self._tools.get(name)
        if tool is None:
            raise AppException(
                message=f"tool not found: {name}",
                code=404,
                status_code=404,
            )
        return tool


# 用装饰器把普通函数变成 AgentTool

def agent_tool(
        name: str,
        description: str,
        parameter_descriptions: dict[str, str],
) -> Callable[[Callable[..., str]], AgentTool]:
    """工具装饰器。
        使用方式：

        @agent_tool(...)
        def summarize_text(text: str) -> str:
            ...

        装饰器会读取函数签名，生成 ToolDefinition。
        """

    # func 被装饰的函数，
    def decorator(func: Callable[..., str]) -> AgentTool:
        parameters = _build_parameters(func, parameter_descriptions)
        return AgentTool(
            definition=ToolDefinition(
                name=name,
                description=description,
                parameters=parameters,
            ),
            handler=func,
        )

    return decorator


def _build_parameters(
        func: Callable[..., str],
        parameter_descriptions: dict[str, str]
) -> list[ToolParameter]:
    """从函数签名中提取工具参数。"""

    """
        def greet(name: str, age: int = 18) -> str:
            return f"{name}: {age}"

        sig = signature(greet)

        print(sig) = (name: str, age: int = 18) -> str
    """
    func_signature = signature(func)

    """

        hints = get_type_hints(greet)

        print(hints)
        结果类似：
        {
            "name": str,
            "age": int,
            "return": str,
        }
    """
    type_hints = get_type_hints(func)

    parameters: list[ToolParameter] = []

    for parameter_name, parameter in func_signature.parameters.items():
        arg_type = type_hints.get(parameter_name, str)
        parameters.append(
            ToolParameter(
                name=parameter_name,
                type=_to_schema_type(arg_type),
                description=parameter_descriptions.get(parameter_name, ""),
                required=parameter.default is parameter.empty,
            )
        )

    return parameters


def _to_schema_type(annotation: Any) -> str:
    """把 Python 类型转换成前端更容易展示的 schema 类型。"""

    if annotation is int:
        return "integer"
    if annotation is float:
        return "number"
    if annotation is bool:
        return "boolean"
    return "string"
