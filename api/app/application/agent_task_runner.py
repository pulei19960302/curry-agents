"""
职责
读取 Redis Stream
  |
  v
找到任务状态
  |
  v
标记 running
  |
  v
调用 ReActAgentService
  |
  v
标记 succeeded 或 failed
"""

import asyncio
from contextlib import suppress
from uuid import UUID

from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.react_agent_service import ReActAgentService
from app.application.unit_of_work import UnitOfWork
from app.core.config import settings
from app.infrastructure.redis_task.task_queue import RedisAgentTaskQueue, AgentTaskStatus


class AgentTaskRunner:
    """
        从 Redis Stream 消费 Agent 任务，并在后台执行。
        第 19 章的执行接口是同步请求：浏览器要等执行结束。
        第 20 章把执行请求拆成两段：
        1. API 只负责把任务放进 Redis Stream。2. Runner 在后台读取任务并执行。
    """

    # async_sessionmaker 是 SQLAlchemy 用来创建异步数据库 Session 的工厂。
    def __init__(self, queue: RedisAgentTaskQueue, session_factory: async_sessionmaker) -> None:
        self.queue = queue
        self.session_factory = session_factory
        self._running = False
        self._task: asyncio.Task | None = None
        self._last_stream_id = "$"

    def start(self) -> None:
        """在 FastAPI 启动时创建后台任务。"""
        if self._task is not None:
            return

        self._running = True
        # 创建一个异步任务
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        """在 FastAPI 关闭时停止后台任务。"""

        self._running = False
        if self._task is None:
            return
        self._task.cancel()
        with suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    # 不断读取 Stream 中的新任务
    async def _run_loop(self) -> None:

        while self._running:
            try:
                streams = await self.queue.redis.xread(
                    {self.queue.stream_name: self._last_stream_id},
                    block=settings.agent_task_poll_timeout_ms,
                    count=1
                )

                for _, messages in streams:
                    for message_id, payload in messages:
                        self._last_stream_id = message_id
                        await self._handle_message(payload)

            except asyncio.CancelledError:
                raise
            except Exception:
                # 这里不能让单次任务异常杀死整个后台循环。
                # 真实项目会接入结构化日志和告警；本章先保证 Runner 可以继续消费下一条任务。
                await asyncio.sleep(1)

    # 根据任务类型分发到具体执行方法
    async def _handle_message(self, payload: dict) -> None:

        task_id = str(payload.get("task_id", ""))
        task_type = str(payload.get("type", ""))
        session_id_text = str(payload.get("session_id", ""))

        if not task_id or not session_id_text:
            return

        task = await self.queue.get_task(task_id)
        # 判断是不是none和状态
        if task is None or task.status is AgentTaskStatus.cancelled:
            return

        await self.queue.mark_running(task_id)

        try:
            if task_type == "execute_plan":
                await self._execute_plan(UUID(session_id_text))
            else:
                raise ValueError(f"unsupported task type: {task_type}")
        except Exception as error:
            await self.queue.mark_failed(task_id, str(error))
            return

        latest_task = await self.queue.get_task(task_id)
        if latest_task and latest_task.status is AgentTaskStatus.cancelled:
            return
        await self.queue.mark_succeeded(task_id)

    #
    async def _execute_plan(self, session_id: UUID) -> None:
        """为后台任务创建独立数据库会话，再复用第 19 章执行逻辑。"""

        async with self.session_factory() as db_session:
            service = ReActAgentService(UnitOfWork(db_session))
            await service.execute_latest_plan(session_id)
