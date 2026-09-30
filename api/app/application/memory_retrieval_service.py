import math
import re
from datetime import datetime, UTC

from app.application.unit_of_work import UnitOfWork
from app.core.config import settings
from app.domain.context_engineering.entities import MemoryContext, MemoryContextItem
from app.domain.memories.entities import AgentMemory, MemoryKind


class MemoryRetrievalService:
    """
        把长期记忆候选压缩成适合当前任务的 MemoryContext。
        第 41 章使用可解释的混合评分：
        - 相关度：当前任务和记忆正文匹配了多少关键词。
        - 重要度：第 40 章保存的 1-5 级重要度。
        - 新鲜度：最近更新的记忆获得少量加分。

        第 43 章可以在不改变 MemoryContext 结构的情况下，把相关度部分
        替换成 embedding、全文检索或模型重排。
    """

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    # 检索并压缩长期记忆
    async def retrieve(
            self,
            *,
            query: str,
            limit: int | None = None,
            max_chars: int | None = None,
            max_item_chars: int | None = None,
            now: datetime | None = None,
    ) -> MemoryContext:
        """根据当前任务返回少量可注入上下文的长期记忆。"""

        current_time = now or datetime.now(UTC)
        item_limit = limit or settings.context_memory_limit
        total_char_limit = max_chars or settings.context_memory_max_chars
        item_char_limit = max_item_chars or settings.context_memory_item_max_chars

        # 查询数据库过滤禁用、删除和过期的长期记忆。存在数据库的。
        candidates = await self.uow.memories.list_retrievable(
            now=current_time,
            limit=settings.context_memory_candidate_limit,
        )

        # 计算混合分数，并过滤完全不相关的普通记忆。
        ranked_items = []

        for memory in candidates:
            item = self._rank_memory(memory=memory, query=query, now=current_time)
            if item.relevance_score < settings.context_memory_min_score:
                continue

            # 普通项目事实和任务经验必须与当前任务有关键词交集。
            # 用户偏好和长期约束属于全局记忆，可以在无直接命中时保留。
            is_global_memory = item.kind in {
                MemoryKind.user_preference,
                MemoryKind.constraint,
            }
            if not item.matched_terms and not is_global_memory:
                continue

            ranked_items.append(item)

        ranked_items.sort(
            key=lambda ranked_item: (
                ranked_item.relevance_score,
                ranked_item.importance,
                ranked_item.updated_at or datetime.min.replace(tzinfo=UTC),
            ),
            reverse=True,
        )

        # 同时应用“条数预算”和“字符预算”。
        included: list[MemoryContextItem] = []
        used_chars: int = 0

        for item in ranked_items:
            # 当前条数比规定的条数多
            if len(included) >= item_limit:
                break

            # 总的剩余的字符数
            remaining_chars = total_char_limit - used_chars
            if remaining_chars <= 0:
                break

            #  允许每条的字符数
            allowed_chars = min(item_char_limit, remaining_chars)
            compressed = self._compress_item(item, allowed_chars)
            if not compressed.content:
                continue

            included.append(compressed)
            used_chars += len(compressed.content)

        return MemoryContext(
            query=" ".join(query.split())[:1000],
            items=included,
            candidate_count=len(candidates),
            omitted_count=max(len(candidates) - len(included), 0),
            total_chars=used_chars,
            max_chars=total_char_limit,
        )

    # 计算单条记忆的混合分数
    def _rank_memory(
            self,
            *,
            memory: AgentMemory,
            query: str,
            now: datetime,
    ) -> MemoryContextItem:

        query_terms = self._tokenize(query)
        memory_terms = self._tokenize(memory.content)

        matched_terms = sorted(
            query_terms & memory_terms,
            key=lambda value: (-len(value), value),
        )[:12]

        # 关键词重叠形成主要相关度。较长关键词权重略高。
        query_weight = min(sum(max(len(term), 1) for term in query_terms) or 1, 40)

        matched_weight = sum(max(len(term), 1) for term in matched_terms)

        lexical_score = min(matched_weight / query_weight, 1.0)

        #  用户偏好和长期约束具有跨任务价值，即使没有直接命中关键词，
        #  也给一个很小的基础分，之后仍受数量和字符预算控制。
        global_memory_bonus = (
            0.04
            if memory.kind in {MemoryKind.user_preference, MemoryKind.constraint}
            else 0.0
        )

        # importance 已经是 1-5，归一化到 0-1。
        importance_score = max(1, min(5, memory.importance)) / 5

        # 新鲜度使用平滑衰减。越接近当前时间，分数越接近 1。
        updated_at = memory.updated_at or memory.created_at or now
        age_days = max((now - updated_at).total_seconds() / 86400, 0)  # 距今多少
        recency_score = math.exp(-age_days / 90)  # 根据90天来处理

        final_score = min(
            lexical_score * 0.6
            + importance_score * 0.2
            + recency_score * 0.10
            + global_memory_bonus,
            1.0
        )

        return MemoryContextItem(
            id=memory.id,
            kind=memory.kind,
            content=memory.content,
            importance=memory.importance,
            # 保留4位小数
            relevance_score=round(final_score, 4),
            matched_terms=matched_terms,
            original_chars=len(memory.content),
            truncated=False,
            source_session_id=memory.source_session_id,
            source_event_id=memory.source_event_id,
            updated_at=memory.updated_at,
        )

    # 按单条字符预算压缩记忆
    @staticmethod
    def _compress_item(
            item: MemoryContextItem,
            max_chars: int,
    ) -> MemoryContextItem:
        if max_chars <= 0:
            content = ""
        elif len(item.content) <= max_chars:
            content = item.content
        elif max_chars <= 12:
            content = item.content[:max_chars]
        else:
            content = item.content[: max_chars - 9] + "...[已裁剪]"

        return MemoryContextItem(
            id=item.id,
            kind=item.kind,
            content=content,
            importance=item.importance,
            relevance_score=item.relevance_score,
            matched_terms=item.matched_terms,
            original_chars=item.original_chars,
            truncated=len(content) < item.original_chars,
            source_session_id=item.source_session_id,
            source_event_id=item.source_event_id,
            updated_at=item.updated_at,
        )

    # 提取中英文检索词
    @staticmethod
    def _tokenize(text: str) -> set[str]:

        """提取英文单词和中文 2-4 字片段。

            这是第 41 章的轻量检索实现，不需要额外分词或向量依赖。
        """

        normalized = text.lower()
        terms = set(re.findall(r"[a-z0-9_]+", normalized))
        chinese_blocks = re.findall(r"[\u4e00-\u9fff]+", normalized)

        for block in chinese_blocks:
            for size in (2, 3, 4):
                if len(block) < size:
                    continue
                terms.update(
                    block[index: index + size]
                    for index in range(len(block) - size + 1)
                )
        return terms
