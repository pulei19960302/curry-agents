import {
  Circle,
  CircleStop,
  LoaderCircle,
  MessageSquare,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import StatusBadge from "./status-badge";
import { formatDate } from "@/lib/format";
import type {
  LoadState,
  SessionItem,
  StatusBadgeView,
} from "@/types/sessions";

type SessionListProps = {
  onDelete: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  selectedId: string | null;
  state: LoadState<SessionItem[]>;
};

export default function SessionList({
  onDelete,
  onSelect,
  selectedId,
  state,
}: SessionListProps) {
  if (state.type === "loading") {
    return (
      <div className="mt-4 grid gap-2" aria-label="正在加载会话">
        {[0, 1, 2].map((item) => (
          <div
            className="h-[76px] animate-pulse rounded-md bg-slate-100"
            key={item}
          />
        ))}
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <div
        className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        role="alert"
      >
        {state.message}
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-slate-300 px-3 py-8 text-center">
        <MessageSquare className="mx-auto text-slate-300" size={22} />
        <p className="mt-3 text-sm font-medium text-slate-600">暂无会话</p>
        <p className="mt-1 text-xs text-slate-400">在上方创建第一个会话</p>
      </div>
    );
  }

  return (
    <ul className="mt-3 grid gap-2" aria-label="会话列表">
      {state.data.map((session) => {
        const selected = session.id === selectedId;

        return (
          <li
            className={`group relative overflow-hidden rounded-md border transition ${
              selected
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
            key={session.id}
          >
            <button
              aria-pressed={selected}
              className="w-full px-3 py-3 pr-11 text-left"
              onClick={() => onSelect(session.id)}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {session.title}
                </span>
                {session.unread_count > 0 ? (
                  <span
                    className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                      selected
                        ? "bg-white text-slate-950"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {session.unread_count > 99 ? "99+" : session.unread_count}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge badge={getStatusBadge(session.status, selected)} />
                <span
                  className={`text-[11px] ${
                    selected ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {formatDate(session.updated_at)}
                </span>
              </div>
            </button>

            <button
              aria-label={`删除会话：${session.title}`}
              className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md transition ${
                selected
                  ? "text-slate-300 hover:bg-white/10 hover:text-white"
                  : "text-slate-400 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
              }`}
              onClick={() => onDelete(session.id)}
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function getStatusBadge(status: string, selected: boolean): StatusBadgeView {
  const badges: Record<string, Pick<StatusBadgeView, "label" | "icon">> = {
    idle: { label: "空闲", icon: Circle },
    running: { label: "运行中", icon: LoaderCircle },
    stopped: { label: "已停止", icon: CircleStop },
    failed: { label: "失败", icon: TriangleAlert },
  };
  const badge = badges[status.toLowerCase()] ?? {
    label: status || "未知",
    icon: Circle,
  };

  return {
    ...badge,
    className: `inline-flex items-center gap-1 text-[11px] ${
      selected ? "text-slate-300" : "text-slate-500"
    }`,
  };
}
