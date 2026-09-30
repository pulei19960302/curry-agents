from datetime import datetime
from uuid import UUID

from app.application.unit_of_work import UnitOfWork
from app.core.exceptions import AppException
from app.domain.memories.entities import AgentMemory, MemoryKind, MemoryCandidate


class MemoryService:
    """
        长期记忆应用服务。

        第40章只负责“沉淀和管理记忆”：
        - 手动新增记忆。
        - 从会话消息和事件中抽取候选。
        - 启用、禁用、删除记忆。

        第41章再把这些记忆接入上下文检索和 Agent 执行流程。
    """

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    # 读取长期记忆列表
    async def list_memories(
            self,
            *,
            kind: MemoryKind | None = None,
            enabled_only: bool = False,
            limit: int = 100,
    ) -> list[AgentMemory]:
        return await self.uow.memories.list_active(
            kind=kind,
            enabled_only=enabled_only,
            limit=limit,
        )

    # 手动新增长期记忆

    async def create_memory(
            self,
            *,
            kind: MemoryKind,
            content: str,
            importance: int = 3,
            source_session_id: UUID | None = None,
            source_event_id: UUID | None = None,
            expires_at: datetime | None = None,
            metadata: dict[str, object] | None = None,
    ) -> AgentMemory:
        # 清理并校验正文。长期记忆会进入后续上下文，不能保存空内容。
        clean_content = content.strip()
        if not clean_content:
            raise AppException(
                message="memory content is required",
                code=400,
                status_code=400,
            )

        # 2. 重要度统一限制在 1-5。后续检索会把重要度作为排序权重。
        safe_importance = max(1, min(5, importance))
        memory = await self.uow.memories.add(
            kind=kind,
            content=clean_content,
            importance=safe_importance,
            source_session_id=source_session_id,
            source_event_id=source_event_id,
            expires_at=expires_at,
            metadata=metadata or {},
        )
        await self.uow.commit()
        return memory

    # 更新长期记忆
    async def update_memory(
            self,
            memory_id: UUID,
            *,
            content: str | None = None,
            importance: int | None = None,
            enabled: bool | None = None,
            expires_at=None,
            metadata: dict[str, object] | None = None,
    ) -> AgentMemory | None:

        clean_content = content.strip() if content is not None else None
        if content is not None and not clean_content:
            raise AppException(
                message="memory content is required",
                code=400,
                status_code=400,
            )

        safe_importance = (
            max(1, min(5, importance)) if importance is not None else None
        )

        memory = await self.uow.memories.update(
            memory_id,
            content=clean_content,
            importance=safe_importance,
            enabled=enabled,
            expires_at=expires_at,
            metadata=metadata,
        )

        await self.uow.commit()
        if memory is None:
            raise AppException(
                message="memory not found",
                code=404,
                status_code=404,
            )
        return memory

    # 删除长期记忆
    async def delete_memory(self, memory_id: UUID) -> AgentMemory:
        memory = await self.uow.memories.soft_delete(memory_id)
        await self.uow.commit()
        if memory is None:
            raise AppException(
                message="memory not found",
                code=404,
                status_code=404,
            )
        return memory

    # 从会话中抽取长期记忆候选
    async def extract_candidates(self, session_id: UUID) -> list[MemoryCandidate]:
        """
            基于规则从会话消息和事件中抽取记忆候选。
            这里故意不直接写入 `agent_memories`：
            长期记忆一旦进入上下文，会影响后续所有任务，所以第40章先让用户确认。
            第41章可以继续接入 LLM 抽取、相似度去重和自动确认策略。
        """
        session = await self.uow.sessions.get(session_id)
        if session is None:
            raise AppException(
                message="session not found",
                code=404,
                status_code=404,
            )

        # 读取会话消息和事件。消息更适合抽取用户偏好，事件更适合抽取任务经验。
        messages = await self.uow.session_messages.list_by_session(session_id)
        events = await self.uow.session_event.list_by_session(session_id)

        candidates: list[MemoryCandidate] = []

        for message in messages:
            candidates.extend(
                self._extract_from_text(
                    text=message.content,
                    source_session_id=session_id,
                    source_event_id=None,
                    source="message",
                )
            )

        for event in events:
            text = " ".join(str(value) for value in event.payload.values())
            candidates.extend(
                self._extract_from_text(
                    text=text,
                    source_session_id=session_id,
                    source_event_id=event.id,
                    source=f"event:{event.type.value}",
                )
            )

        # 5. 简单去重。后续可以升级为 embedding 相似度去重。
        return self._deduplicate_candidates(candidates)

    def _extract_from_text(
            self,
            *,
            text: str,
            source_session_id: UUID,
            source_event_id: UUID | None,
            source: str,
    ) -> list[MemoryCandidate]:

        # 单个信息字数少于8就直接不要
        clean_text = " ".join(text.strip().split())
        if len(clean_text) < 8:
            return []

        candidates: list[MemoryCandidate] = []

        if self._contains_any(clean_text, ["我喜欢", "我希望", "偏好", "以后", "记住"]):
            candidates.append(
                MemoryCandidate(
                    kind=MemoryKind.user_preference,
                    content=clean_text[:500],
                    importance=4,
                    reason="文本中出现偏好或记住类表达。",
                    source_session_id=source_session_id,
                    source_event_id=source_event_id,
                    metadata={"source": source},
                )
            )

        if self._contains_any(clean_text, ["项目", "架构", "技术栈", "数据库", "前端", "后端"]):
            candidates.append(
                MemoryCandidate(
                    kind=MemoryKind.project_fact,
                    content=clean_text[:500],
                    importance=3,
                    reason="文本中包含项目事实或技术背景。",
                    source_session_id=source_session_id,
                    source_event_id=source_event_id,
                    metadata={"source": source},
                )
            )

        if self._contains_any(clean_text, ["必须", "不要", "不能", "要求", "约束"]):
            candidates.append(
                MemoryCandidate(
                    kind=MemoryKind.constraint,
                    content=clean_text[:500],
                    importance=5,
                    reason="文本中包含长期约束或明确要求。",
                    source_session_id=source_session_id,
                    source_event_id=source_event_id,
                    metadata={"source": source},
                )
            )

        if self._contains_any(clean_text, ["验证", "报错", "修复", "提交", "部署", "经验"]):
            candidates.append(
                MemoryCandidate(
                    kind=MemoryKind.task_experience,
                    content=clean_text[:500],
                    importance=3,
                    reason="文本中包含任务执行经验或排查经验。",
                    source_session_id=source_session_id,
                    source_event_id=source_event_id,
                    metadata={"source": source},
                )
            )

        return candidates

    @staticmethod
    def _contains_any(text: str, keywords: list[str]) -> bool:
        return any(keyword in text for keyword in keywords)

    @staticmethod
    def _deduplicate_candidates(
            candidates: list[MemoryCandidate],
    ) -> list[MemoryCandidate]:
        seen: set[tuple[str, str]] = set()
        result: list[MemoryCandidate] = []
        for candidate in candidates:
            key = (candidate.kind.value, candidate.content)
            if key in seen:
                continue
            seen.add(key)
            result.append(candidate)
        return result[:20]
