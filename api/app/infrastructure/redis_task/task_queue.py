from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from redis.asyncio import Redis

from app.core.config import settings


class AgentTaskStatus(StrEnum):
    # 任务已经入队，还没执行
    queued = "queued"

    # 任务正在执行
    running = "running"

    # 任务执行成功
    succeeded = "succeeded"

    # 任务执行失败
    failed = "failed"

    # 任务取消
    cancelled = "cancelled"


# 给前端看的任务对象
@dataclass(slots=True)
class AgentTask:
    id: str
    session_id: UUID
    type: str
    status: AgentTaskStatus
    error: str | None
    created_at: str
    updated_at: str


class RedisAgentTaskQueue:
    """
        基于 Redis Stream 的 Agent 任务队列。
        本章只使用一个 Stream 和一个 API 内置 Runner，先把后台任务模型跑通。
        后续可以继续扩展 consumer group、多个 worker 和任务重试策略。
    """

    def __init__(self, redis: Redis, stream_name: str | None = None) -> None:
        self.redis = redis
        self.stream_name = stream_name or settings.agent_task_stream

    # 创建任务并写入 Stream
    async def enqueue_execute_plan(self, session_id: UUID) -> AgentTask:
        """创建一个执行计划任务，并把任务 ID 写入 Redis Stream。"""

        now = self._now()
        task = AgentTask(
            id=str(uuid4()),
            session_id=session_id,
            type="execute_plan",
            status=AgentTaskStatus.queued,
            error=None,
            created_at=now,
            updated_at=now,
        )

        """
            为什么先写 Hash，再写 Stream？
            因为 Runner 读到 Stream 消息后，会立刻根据 task_id 查询任务状态。
            如果先写 Stream，再写 Hash，极端情况下 Runner 可能先读到了消息，但任务状态还不存在。
        """

        # 任务状态写入 Redis Hash
        await self._write_task(task)

        # 任务消息写入 Redis Stream
        await self.redis.xadd(
            self.stream_name,
            {
                "task_id": task.id,
                "session_id": str(session_id),
                "type": task.type,
            },
        )
        return task

    # 从redis hash里面去读
    async def get_task(self, task_id: str) -> AgentTask | None:
        data = await self.redis.hgetall(self._task_key(task_id))

        if not data:
            return None
        return self._to_task(data)

    # 取消还没有完成的任务
    async def cancel_task(self, task_id: str) -> AgentTask | None:
        """
            把任务标记为 cancelled。
            本章的 Runner 是短任务同步执行，如果任务已经 running，取消会尽力标记状态；
            第 20 章先理解任务状态流转，后续长任务会再加入更细的中断点。
        """
        task = await self.get_task(task_id)
        if task is None:
            return None

        # 判断状态
        if task.status in {
            AgentTaskStatus.succeeded,
            AgentTaskStatus.failed,
            AgentTaskStatus.cancelled,
        }:
            return task

        task.status = AgentTaskStatus.cancelled
        task.updated_at = self._now()
        await self._write_task(task)
        return task

    async def mark_running(self, task_id: str) -> AgentTask | None:
        return await self._update_status(task_id, AgentTaskStatus.running)

    async def mark_succeeded(self, task_id: str) -> AgentTask | None:
        return await self._update_status(task_id, AgentTaskStatus.succeeded)

    async def mark_failed(self, task_id: str, error: str) -> AgentTask | None:
        return await self._update_status(task_id, AgentTaskStatus.failed, error=error)

    async def _update_status(
            self,
            task_id: str,
            status: AgentTaskStatus,
            error: str | None = None,
    ) -> AgentTask | None:
        task = await self.get_task(task_id)
        if task is None:
            return None
        task.status = status
        task.error = error
        task.updated_at = self._now()
        await self._write_task(task)
        return task

    # 封装 Redis Hash 读写细节
    async def _write_task(self, task: AgentTask) -> None:
        await self.redis.hset(
            self._task_key(task.id),
            mapping={
                "id": task.id,
                "session_id": str(task.session_id),
                "type": task.type,
                "status": task.status.value,
                "error": task.error or "",
                "created_at": task.created_at,
                "updated_at": task.updated_at,
            }
        )

    def _to_task(self, data: dict) -> AgentTask:
        return AgentTask(
            id=str(data["id"]),
            session_id=UUID(str(data["session_id"])),
            type=str(data["type"]),
            status=AgentTaskStatus(str(data["status"])),
            error=str(data["error"]) or None,
            created_at=str(data["created_at"]),
            updated_at=str(data["updated_at"]),
        )

    def _task_key(self, task_id: str) -> str:
        return f"agent:task:{task_id}"

    def _now(self) -> str:
        return datetime.now(UTC).isoformat()


# 创建redis 客户端
def create_redis_client() -> Redis:
    """创建 Redis 客户端。

       decode_responses=True 会把 Redis 返回值解码成字符串，代码里不需要反复处理 bytes。
       """

    return Redis.from_url(settings.redis_url, decode_responses=True)
