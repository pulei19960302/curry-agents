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