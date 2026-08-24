import type { LucideIcon } from "lucide-react";

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
  | { type: "loading" }
  | { type: "ready"; data: T }
  | { type: "error"; message: string };

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
