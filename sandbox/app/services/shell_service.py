import asyncio
from asyncio.subprocess import PIPE, Process
from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

from app.core.config import Settings
from app.core.exceptions import SandboxException
from app.schemas.shell import (
    ShellSessionListResponse,
    ShellSessionResponse,
    ShellTerminateResponse,
    ShellWriteResponse,
)


@dataclass(slots=True)
class ShellSession:
    """保存一个 Shell 子进程及其运行时状态。

    这是服务内部使用的可变会话对象，不直接作为 API 响应返回。后台协程会在
    进程运行期间持续修改 ``status``、``return_code`` 和输出相关字段。

    ``slots=True`` 会为字段生成固定的槽位，阻止随意添加未声明的属性，并减少
    大量会话对象的内存开销。

    Attributes:
        id: 当前 Shell 会话的唯一标识，和操作系统的进程 PID 不是一回事。
        command: 交给系统 Shell 执行的原始命令字符串。
        cwd: 命令启动时使用的、相对于 workspace 的工作目录。
        process: ``asyncio`` 创建的子进程对象，可用于等待、写入和终止进程。
        status: 服务维护的业务状态，初始为 ``running``。
        return_code: 子进程退出码；进程尚未结束时为 ``None``。
        output_chunks: 按读取顺序保存的 stdout 和 stderr 文本片段。
        output_truncated: 是否曾因超过输出上限而丢弃过较早的内容。
    """

    id: str
    command: str
    cwd: str
    process: Process
    status: str = "running"
    return_code: int | None = None

    # 每个会话都必须拥有独立列表。不能直接写成 ``=[]``，否则不同实例可能
    # 共享同一个可变列表；default_factory 会在创建实例时生成新列表。
    output_chunks: list[str] = field(default_factory=list)
    output_truncated: bool = False


class SandboxShellService:
    """启动并管理当前 Sandbox 服务进程中的 Shell 会话。

    每条命令都会对应一个 :class:`ShellSession`，会话保存在内存字典中。服务
    重启后记录会全部丢失，目前也没有自动移除已结束会话的清理机制。

    路径检查只保证命令的初始工作目录位于 ``workspace``。由于命令是通过
    ``create_subprocess_shell`` 交给系统 Shell 执行的，命令本身仍可包含绝对
    路径、``cd``、管道和重定向等 Shell 语法。真正的系统级隔离应由运行该
    服务的容器、用户权限和挂载策略提供，不能只依靠 ``_resolve_workdir``。
    """

    def __init__(self, settings: Settings) -> None:
        """初始化 Shell 服务并确保 workspace 已存在。

        Args:
            settings: 提供 workspace、输出保留上限和默认等待时间等配置。
        """
        self.settings = settings

        # 先规范化为绝对路径，后续所有 cwd 边界判断都以它为准。
        self.workspace = Path(settings.workspace_dir).resolve()

        # parents=True 会补齐多级父目录；exist_ok=True 允许目录已经存在。
        self.workspace.mkdir(parents=True, exist_ok=True)

        # key 是本服务生成的会话 UUID，value 是持续更新的运行时会话对象。
        # 这是进程内状态，不会写入数据库或 Redis。
        self._sessions: dict[str, ShellSession] = {}

    async def execute(self, command: str, cwd: str = ".") -> ShellSessionResponse:
        """启动一条 Shell 命令并立即返回会话快照。

        Args:
            command: 交给系统 Shell 解析和执行的完整命令字符串。
            cwd: 相对于 workspace 的初始工作目录，默认为 workspace 根目录。

        Returns:
            新会话的当前状态。这里只等待“进程创建成功”，不会等待命令执行
            完成，因此通常返回 ``running``，输出也可能暂时为空。

        Raises:
            SandboxException: cwd 是绝对路径或解析后逃逸出 workspace 时抛出。
            OSError: 操作系统无法创建工作目录或启动子进程时可能抛出。
        """
        # 将用户传入的相对 cwd 转换为 workspace 内经过校验的绝对路径。
        workdir = self._resolve_workdir(cwd)

        # create_subprocess_shell 会通过系统 Shell 解释 command，所以 command 中
        # 的管道、重定向、变量展开等语法都会生效。
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=workdir,
            # PIPE 将子进程的三个标准流连接到当前 Python 进程：stderr/stdout
            # 可被后台协程读取，stdin 可由 write() 方法继续写入。
            stderr=PIPE,
            stdout=PIPE,
            stdin=PIPE,
        )

        # 会话 ID 使用应用生成的 UUID；process.pid 才是操作系统分配的 PID。
        session = ShellSession(
            id=str(uuid4()),
            command=command,
            cwd=self._to_relative_path(workdir),
            process=process,
        )

        # 必须先保存会话，后续 get/wait/write/terminate 才能通过 ID 找到进程。
        self._sessions[session.id] = session

        # 三个任务都在事件循环后台并发运行，execute 不会等待它们完成：
        # 1. 按行读取标准输出；2. 按行读取错误输出；3. 等待退出并更新状态。
        # stdout 和 stderr 的最终合并顺序取决于事件循环的实际调度顺序。
        asyncio.create_task(self._collect_stream(session, process.stdout, "stdout"))
        asyncio.create_task(self._collect_stream(session, process.stderr, "stderr"))
        asyncio.create_task(self._watch_process(session))

        # 返回响应副本，不把 Process 等内部运行时对象暴露给 API 调用方。
        return self._to_response(session)

    def get(self, session_id: str) -> ShellSessionResponse:
        """按会话 ID 返回当前最新状态和已经收集到的输出。

        该方法只读取内存快照，不等待进程状态发生变化。会话不存在时由
        ``_get_session`` 统一抛出 404 类型的 ``SandboxException``。
        """
        return self._to_response(self._get_session(session_id))

    def list_sessions(self) -> ShellSessionListResponse:
        """列出当前服务进程内仍被记录的全部 Shell 会话。

        已经成功、失败或被终止的会话也会包含在内，因为当前实现不会自动从
        ``_sessions`` 中清理它们。字典保持插入顺序，因此通常按创建顺序返回。
        """
        return ShellSessionListResponse(
            items=[self._to_response(session) for session in self._sessions.values()]
        )

    async def wait(
        self,
        session_id: str,
        timeout_seconds: float | None = None,
    ) -> ShellSessionResponse:
        """在限定时间内等待指定会话的子进程结束。

        Args:
            session_id: 要等待的 Shell 会话 ID。
            timeout_seconds: 本次最多等待的秒数；为 ``None`` 或其他假值时使用
                ``settings.shell_default_timeout_seconds``。

        Returns:
            等待结束时的会话快照。超时不是接口错误：方法会停止等待并返回
            当前状态，子进程仍会在后台继续运行。

        ``asyncio.wait_for`` 的超时只约束本次 HTTP/服务调用等待多久，不会
        自动杀死子进程。``process.wait()`` 只等待退出码，不负责读取 stdout
        和 stderr；输出由 ``_collect_stream`` 后台任务持续收集。
        """
        session = self._get_session(session_id)

        # 这里使用 or，因此显式传入 0 也会回退到配置的默认超时时间。
        timeout = timeout_seconds or self.settings.shell_default_timeout_seconds
        try:
            await asyncio.wait_for(session.process.wait(), timeout=timeout)
        except TimeoutError:
            # 超时后只返回快照，不修改 status，也不终止仍在运行的进程。
            return self._to_response(session)
        return self._to_response(session)

    async def write(self, session_id: str, value: str) -> ShellWriteResponse:
        """向一个仍在运行的子进程标准输入写入 UTF-8 文本。

        Args:
            session_id: 目标 Shell 会话 ID。
            value: 要写入 stdin 的文本。方法不会自动追加换行符；如果目标程序
                按行读取，调用方通常需要自行传入 ``\n``。

        Returns:
            会话 ID 和本次写入的 UTF-8 字节数。

        Raises:
            SandboxException: 会话不存在、状态不是 ``running``，或者启动进程
                时没有建立 stdin 管道时抛出。

        返回成功仅表示数据已交给异步写入通道，并不表示子进程已经读取或处理
        了这些内容。
        """
        session = self._get_session(session_id)

        # 已结束/已终止的会话不能继续写；stdin 为 None 表示没有可写管道。
        if session.status != "running" or session.process.stdin is None:
            raise SandboxException(message="shell session is not writable")

        # 子进程管道传输 bytes，因此先把 Python 字符串编码为 UTF-8。
        encoded = value.encode("utf-8")

        # write() 通常只把数据放入内存缓冲区，不会等待子进程实际消费。
        session.process.stdin.write(encoded)

        # drain() 实现背压：缓冲区积压过多时暂停当前协程，等数据向子进程方向
        # 排出到安全水位后再返回，防止生产速度长期超过子进程读取速度。
        await session.process.stdin.drain()
        return ShellWriteResponse(id=session.id, written=len(encoded))

    async def terminate(self, session_id: str) -> ShellTerminateResponse:
        """请求终止指定会话，并等待进程退出。

        对仍在运行的进程先调用 ``terminate()`` 请求正常终止，并最多等待两秒；
        如果仍未退出，则调用 ``kill()`` 强制终止并一直等待进程被系统回收。

        已经结束的会话不会再次发送信号，但仍返回 ``terminated=True``，这里的
        布尔值表示终止接口已完成处理，不一定表示本次调用真的发送了信号。

        注意：``create_subprocess_shell`` 启动的是 Shell 进程。当前实现没有创建
        和终止独立进程组，因此复杂命令派生出的子孙进程是否一起结束取决于
        操作系统和 Shell 的行为。
        """
        session = self._get_session(session_id)
        if session.status == "running":
            # 在 POSIX 系统通常发送 SIGTERM；Windows 上由 asyncio 做平台适配。
            session.process.terminate()

            # 先写入业务状态，防止 _watch_process 随后把主动终止改成 failed。
            session.status = "terminated"
            try:
                await asyncio.wait_for(session.process.wait(), timeout=2)
            except TimeoutError:
                # 正常终止超时后升级为强制终止，并等待系统确认进程已经退出。
                session.process.kill()
                await session.process.wait()
        return ShellTerminateResponse(id=session.id, terminated=True)

    async def _collect_stream(
        self,
        session: ShellSession,
        stream: asyncio.StreamReader | None,
        name: str,
    ) -> None:
        """持续按行读取 stdout 或 stderr，并追加到会话输出。

        Args:
            session: 输出所属的会话对象。
            stream: ``Process.stdout`` 或 ``Process.stderr`` 对应的异步读取器。
            name: 流名称；``stderr`` 内容会添加 ``[stderr]`` 前缀。

        ``readline()`` 会等待换行符或流结束。如果子进程输出内容但一直不换行，
        这部分内容可能要到后续出现换行或进程关闭流时才会进入会话快照。
        """
        if stream is None:
            # 创建子进程时没有为该标准流配置 PIPE，就不会获得 StreamReader。
            return

        while True:
            chunk = await stream.readline()
            if not chunk:
                # 空 bytes 表示流已到 EOF，子进程不会再向这个流写入内容。
                break

            # stdout 保持原样；stderr 增加文本前缀，方便合并后区分来源。
            prefix = "" if name == "stdout" else "[stderr] "

            # 子进程可能输出非 UTF-8 或被截断的字节序列。errors="replace" 会用
            # 替代字符保留其余可解码内容，而不是让后台任务因解码错误退出。
            self._append_output(session, prefix + chunk.decode("utf-8", errors="replace"))

    async def _watch_process(self, session: ShellSession) -> None:
        """等待子进程退出，并把操作系统退出码映射为业务状态。

        退出码 0 视为 ``succeeded``，非 0 视为 ``failed``。如果 terminate()
        已经把状态标记成 ``terminated``，这里只记录退出码，不覆盖主动终止状态。
        """
        return_code = await session.process.wait()
        session.return_code = return_code

        if session.status == "terminated":
            return
        session.status = "succeeded" if return_code == 0 else "failed"

    def _append_output(self, session: ShellSession, text: str) -> None:
        """追加输出，并只保留配置字节上限以内的最新内容。

        一旦完整输出超过 ``shell_output_limit``，会丢弃较早内容并设置
        ``output_truncated=True``。截取按照 UTF-8 字节数而不是字符数进行，
        因而可能正好切在一个多字节字符中间；解码时会用替代字符处理该边界。

        当前实现每次追加都会重新拼接和编码全部已保留输出，逻辑直观但在大量
        高频小片段场景下会产生额外的字符串复制开销。
        """
        session.output_chunks.append(text)
        output = "".join(session.output_chunks)

        # 未超过上限时保留全部片段，方便下一次继续追加。
        if len(output.encode("utf-8")) <= self.settings.shell_output_limit:
            return

        session.output_truncated = True

        # 取最后 N 个字节，确保响应保留的是最新输出，而不是最早输出。
        truncated = output.encode("utf-8")[-self.settings.shell_output_limit:]

        # 截断后折叠成一个片段，下一次追加会继续以它作为已有输出。
        session.output_chunks = [truncated.decode("utf-8", errors="replace")]

    def _resolve_workdir(self, cwd: str) -> Path:
        """解析并校验命令启动时使用的工作目录。

        空字符串和纯空白按 ``.`` 处理。绝对路径会被拒绝；相对路径与
        workspace 拼接并 ``resolve`` 后，必须仍然是 workspace 本身或其后代。
        目标目录不存在时会自动递归创建。

        ``resolve`` 也会处理 ``..`` 和可解析的符号链接，因此通过路径穿越或
        指向 workspace 外部的符号链接指定 cwd 都会被边界检查拒绝。
        """
        # 去除首尾空白；无有效内容时使用 workspace 根目录。
        clean_cwd = cwd.strip() or "."

        # API 只接受相对工作目录，避免调用方直接指定宿主机/容器绝对位置。
        if Path(clean_cwd).is_absolute():
            raise SandboxException(message="absolute cwd is not allowed")

        # 规范化路径后再校验，不能只对原始字符串检查是否包含 ".."。
        target = (self.workspace / clean_cwd).resolve()
        if target != self.workspace and self.workspace not in target.parents:
            raise SandboxException(message="cwd escapes workspace")

        # 允许命令直接在尚不存在的多级相对目录下启动。
        target.mkdir(parents=True, exist_ok=True)
        return target

    def _get_session(self, session_id: str) -> ShellSession:
        """从内存注册表取得会话，不存在时抛出统一的 404 异常。"""
        session = self._sessions.get(session_id)
        if session is None:
            raise SandboxException(
                message="shell session not found",
                code=404,
                status_code=404,
            )
        return session

    def _to_relative_path(self, path: Path) -> str:
        """把绝对路径转换成 API 使用的 workspace 相对 POSIX 路径。

        workspace 根目录表示为 ``.``，其余路径统一使用 ``/`` 分隔符，避免向
        调用方暴露容器中的绝对 workspace 路径。
        """
        relative = path.resolve().relative_to(self.workspace)
        return "." if str(relative) == "." else relative.as_posix()

    def _to_response(self, session: ShellSession) -> ShellSessionResponse:
        """把内部会话对象转换成可序列化的 API 响应快照。

        ``Process`` 不能也不应该暴露给客户端，因此响应只挑选公开字段；分段
        保存的 ``output_chunks`` 会在这里拼成一个字符串 ``output``。
        """
        return ShellSessionResponse(
            id=session.id,
            command=session.command,
            cwd=session.cwd,
            status=session.status,
            return_code=session.return_code,
            output="".join(session.output_chunks),
            output_truncated=session.output_truncated,
        )
