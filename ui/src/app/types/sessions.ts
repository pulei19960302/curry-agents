import type { LucideIcon } from "lucide-react";
import { UploadedFile } from "./files";

export type SessionItem = {
  id: string;
  title: string;
  status: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

export type SessionListData = {
  items: SessionItem[];
};

export type LoadState<T> =
  { type: "loading" } | { type: "ready"; data: T } | { type: "error"; message: string };

export type StatusBadgeView = {
  label: string;
  className: string;
  icon: LucideIcon;
};

// 智能体给的消息
export type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type MessageListData = {
  items: ChatMessage[];
};

// 智能体事件
export type SessionEventItem = {
  id: string;
  session_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SessionEventListData = {
  items: SessionEventItem[];
};

export type MessageCreateData = {
  content: string;
};

// session 对象里面的file
export type SessionFileItem = {
  id: string;
  session_id: string;
  file_id: string;
  file: UploadedFile;
  created_at: string;
};

export type SessionFileListData = {
  items: SessionFileItem[];
};

export type AgentTaskItem = {
  id: string;
  session_id: string;
  type: string;
  status:
    | "queued"
    | "running"
    | "waiting"
    | "completed"
    | "succeeded"
    | "failed"
    | "stopped"
    | "cancelled";
  error: string | null;
  created_at: string;
  updated_at: string;
  parent_task_id: string | null;
  retry_count: number;
};

export type ContextMessage = {
  role: string;
  content: string;
  original_chars: number;
  truncated: boolean;
  created_at: string;
};

export type ContextEventSummary = {
  type: string;
  count: number;
  latest_at: string;
};

export type ContextFileReference = {
  id: string;
  name: string;
  content_type: string;
  size: number;
  usage_hint: string;
};

export type ContextBudget = {
  message_limit: number;
  event_limit: number;
  max_message_chars: number;
  included_messages: number;
  omitted_messages: number;
  included_events: number;
  omitted_events: number;
  total_message_chars: number;
  memory_limit: number;
  max_memory_chars: number;
  included_memories: number; // 本次真正注入 Agent 的长期记忆数。
  omitted_memories: number; // 因相关度或预算没有注入的候选数。
  total_memory_chars: number; // 长期记忆区域实际使用的字符数。
};

export type SessionContextData = {
  session_id: string;
  summary: string;
  messages: ContextMessage[];
  event_summaries: ContextEventSummary[];
  files: ContextFileReference[];
  budget: ContextBudget;
  memory_context: MemoryContext;
};

export type MemoryContextItem = {
  id: string;
  kind: string;
  content: string;
  importance: number;
  relevance_score: number;
  matched_terms: string[];
  original_chars: number;
  truncated: boolean;
  source_session_id: string | null;
  source_event_id: string | null;
  updated_at: string | null;
};

export type MemoryContext = {
  query: string;
  items: MemoryContextItem[];
  candidate_count: number;
  omitted_count: number;
  total_chars: number;
  max_chars: number;
};
