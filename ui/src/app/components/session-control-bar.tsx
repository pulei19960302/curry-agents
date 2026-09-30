import { BellOff, BrainCircuit, Square } from "lucide-react";

import type { SessionItem } from "@/types/sessions";

type SessionControlBarProps = {
  clearingUnread: boolean;
  onClearUnread: () => void;
  onOpenContext: () => void;
  onStop: () => void;
  selectedSession: SessionItem | null;
  stopping: boolean;
};

export default function SessionControlBar({
  clearingUnread,
  onClearUnread,
  onOpenContext,
  onStop,
  selectedSession,
  stopping,
}: SessionControlBarProps) {
  const isRunning = selectedSession?.status === "running";
  const hasUnread = Boolean(selectedSession && selectedSession.unread_count > 0);

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-8 py-4 backdrop-blur max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div>
        <div className="text-sm font-medium text-zinc-100">
          {selectedSession ? selectedSession.title : "未选择会话"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          状态：{selectedSession?.status ?? "-"} · 未读：
          {selectedSession?.unread_count ?? 0}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={!selectedSession}
          onClick={onOpenContext}
          type="button"
        >
          <BrainCircuit size={15} aria-hidden="true" />
          上下文
        </button>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-700"
          disabled={!selectedSession || !hasUnread || clearingUnread}
          onClick={onClearUnread}
          type="button"
        >
          <BellOff size={15} aria-hidden="true" />
          清未读
        </button>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-rose-500/30 px-3 text-sm text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:text-zinc-700"
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
