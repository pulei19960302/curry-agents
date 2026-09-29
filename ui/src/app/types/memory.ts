export type MemoryKind = "user_preference" | "project_fact" | "task_experience" | "constraint";

export type AgentMemoryItem = {
  id: string; // 长期记忆 ID。
  kind: MemoryKind; // 记忆分类，用来决定后续如何注入上下文。
  content: string; // 记忆正文，后续会进入 Agent 上下文。
  importance: number; // 重要度，1-5；第41章检索会用它参与排序。
  enabled: boolean; // false 表示保留但不参与后续检索。
  source_session_id: string | null; // 记忆来源会话，方便追溯。
  source_event_id: string | null; // 记忆来源事件，方便追溯。
  expires_at: string | null; // 过期时间；为空表示长期有效。
  metadata: Record<string, unknown>; // 抽取来源、规则等额外信息。
  created_at: string | null;
  updated_at: string | null;
};

export type AgentMemoryListData = {
  items: AgentMemoryItem[];
};

export type MemoryCandidateItem = {
  kind: MemoryKind;
  content: string;
  importance: number;
  reason: string;
  source_session_id: string | null;
  source_event_id: string | null;
  metadata: Record<string, unknown>;
};

export type MemoryCandidateListData = {
  items: MemoryCandidateItem[];
};
