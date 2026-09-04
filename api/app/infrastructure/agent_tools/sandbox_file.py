from app.core.config import settings
from app.domain.agent_core.tools import ToolRegistry, AgentTool, ToolDefinition, ToolParameter
from app.infrastructure.sandbox.file_client import SandboxFileClient


# 创建沙箱客户端
def build_sandbox_file_client() -> SandboxFileClient:
    """根据主 API 配置创建 Sandbox 文件客户端。"""

    return SandboxFileClient(
        base_url=settings.sandbox_api_base_url,
        timeout_seconds=settings.sandbox_api_timeout_seconds,
    )


def register_sandbox_file_tools(
        registry: ToolRegistry,
        client: SandboxFileClient | None = None,
) -> None:
    """把 Sandbox 文件能力注册成 Agent 可调用工具。"""

    file_client = client or build_sandbox_file_client()

    # 注册获取文件列表的
    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="file_list",
                description="列出 Sandbox 工作目录中的文件和子目录。",
                parameters=[
                    ToolParameter(
                        name="path",
                        type="string",
                        description="要浏览的相对路径，默认是 workspace 根目录。",
                        required=False,
                    )
                ]
            ),
            # 相当于 def handler(path = "."): return _format_file_list(file_client.list_files(path or "."))
            handler=lambda path=".": _format_file_list(file_client.list_files(path or ".")),
        )
    )

    # 注册读取文件的tool
    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="file_read",
                description="读取 Sandbox 工作目录中的文本文件。",
                parameters=[
                    ToolParameter(
                        name="path",
                        type="string",
                        description="要读取的文件相对路径。",
                    )
                ]

            ),
            handler=lambda path: _format_file_content(file_client.read_file(path)),
        )
    )

    # file_write 写文件
    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="file_write",
                description="向 Sandbox 工作目录写入文本文件。",
                parameters=[
                    ToolParameter(
                        name="path",
                        type="string",
                        description="要写入的文件相对路径。",
                    ),
                    ToolParameter(
                        name="content",
                        type="string",
                        description="要写入文件的文本内容。",
                    ),
                ],
            ),
            handler=lambda path, content: _format_write_result(file_client.write_file(path, content)),
        )
    )

    # file_replace 替换文本
    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="replace_file",
                description="替换 Sandbox 文本文件中的指定内容。",
                parameters=[
                    ToolParameter(
                        name="path",
                        type="string",
                        description="要修改的文件相对路径。",
                    ),
                    ToolParameter(
                        name="old_text",
                        type="string",
                        description="需要被替换的原文本。",
                    ),
                    ToolParameter(
                        name="new_text",
                        type="string",
                        description="替换后的新文本。",
                    ),
                ]
            ),
            handler=lambda path, old_text, new_text: _format_replace_result(
                file_client.replace_text(path, old_text, new_text)),
        )
    )

    # 删除文本
    registry.register(
        AgentTool(
            definition=ToolDefinition(
                name="file_delete",
                description="删除 Sandbox 工作目录中的文件或目录。",
                parameters=[
                    ToolParameter(
                        name="path",
                        type="string",
                        description="要删除的文件或目录相对路径。",
                    )
                ],
            ),
            handler=lambda path: _format_delete_result(file_client.delete_path(path)),
        )
    )


def _format_file_list(data: dict) -> str:
    items = data.get("items", [])
    if not items:
        return f"{data.get('current_path', '.')} 目录为空。"

    lines = [f"当前目录：{data.get('current_path', '.')}"]
    for item in items:
        marker = "目录" if item.get("type") == "directory" else "文件"
        lines.append(
            f"- [{marker}] {item.get('path')} ({item.get('size', 0)} bytes)"
        )
    return "\n".join(lines)


def _format_file_content(data: dict) -> str:
    suffix = "\n\n内容已截断。" if data.get("truncated") else ""
    return f"文件：{data.get('path')}\n大小：{data.get('size')} bytes\n\n{data.get('content', '')}{suffix}"


def _format_write_result(data: dict) -> str:
    return f"文件已写入：{data.get('path')}，大小 {data.get('size')} bytes。"


def _format_replace_result(data: dict) -> str:
    return (
        f"文件已替换：{data.get('path')}，"
        f"替换次数 {data.get('replacements')}。\n\n{data.get('content', '')}"
    )


def _format_delete_result(data: dict) -> str:
    if data.get("deleted"):
        return f"路径已删除：{data.get('path')}"
    return f"路径未删除：{data.get('path')}"
