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
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  error: string | null;
  created_at: string;
  updated_at: string;
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
};

export type SessionContextData = {
  session_id: string;
  summary: string;
  messages: ContextMessage[];
  event_summaries: ContextEventSummary[];
  files: ContextFileReference[];
  budget: ContextBudget;
};
