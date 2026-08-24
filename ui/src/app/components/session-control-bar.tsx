import { BellOff, Square } from "lucide-react";

import type { SessionItem } from "@/types/sessions";

type SessionControlBarProps = {
  clearingUnread: boolean;
  onClearUnread: () => void;
  onStop: () => void;
  selectedSession: SessionItem | null;
  stopping: boolean;
};

export default function SessionControlBar({
  clearingUnread,
  onClearUnread,
  onStop,
  selectedSession,
  stopping,
}: SessionControlBarProps) {
  const isRunning = selectedSession?.status === "running";
  const hasUnread = Boolean(
    selectedSession && selectedSession.unread_count > 0,
  );

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div>
        <div className="text-sm font-medium text-slate-900">
          {selectedSession ? selectedSession.title : "未选择会话"}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          状态：{selectedSession?.status ?? "-"} · 未读：
          {selectedSession?.unread_count ?? 0}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={!selectedSession || !hasUnread || clearingUnread}
          onClick={onClearUnread}
          type="button"
        >
          <BellOff size={15} aria-hidden="true" />
          清未读
        </button>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
          disabled={!selectedSession || !isRunning || stopping}
          onClick={onStop}
          type="button"
        >
          <Square size={14} aria-hidden="true" />
          停止
        </button>
      </div>
    </div>
  );
}
