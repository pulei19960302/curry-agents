import { Bot, Plus, RefreshCw, Settings } from "lucide-react";

import SessionList from "./session-list";
import type { LoadState, SessionItem } from "@/types/sessions";

type AppSidebarProps = {
  actionError: string | null;
  activeView: "workspace" | "settings";
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onViewChange: (view: "workspace" | "settings") => void;
  onSelectSession: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: LoadState<SessionItem[]>;
  submitting: boolean;
  title: string;
  onTitleChange: (value: string) => void;
};

export default function AppSidebar({
  actionError,
  activeView,
  onCreateSession,
  onDeleteSession,
  onRefresh,
  onViewChange,
  onSelectSession,
  selectedSessionId,
  sessions,
  submitting,
  title,
  onTitleChange,
}: AppSidebarProps) {
  return (
    <aside className="flex h-screen min-h-0 flex-col overflow-hidden border-r border-white/10 bg-black px-4 py-5 max-lg:h-auto max-lg:max-h-[46vh] max-lg:border-r-0 max-lg:border-b">
      <div className="flex shrink-0 items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/15 text-blue-400">
          <Bot size={22} aria-hidden="true" />
        </div>
        <div>
          <div className="text-base leading-5 font-semibold text-zinc-50">CurryAgent</div>
          <div className="mt-1 text-xs text-zinc-500">Agent Workspace</div>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
        <button
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            activeView === "workspace"
              ? "bg-blue-500 text-white"
              : "text-zinc-500 hover:text-zinc-100"
          }`}
          onClick={() => onViewChange("workspace")}
          type="button"
        >
          对话
        </button>
        <button
          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
            activeView === "settings"
              ? "bg-white/15 text-zinc-50"
              : "text-zinc-600 hover:bg-white/10 hover:text-zinc-100"
          }`}
          onClick={() => onViewChange("settings")}
          title="设置"
          type="button"
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>

      <form
        className="mt-4 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateSession();
        }}
      >
        <label className="text-xs font-medium text-zinc-500" htmlFor="title">
          新建任务
        </label>
        <div className="flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 text-sm text-zinc-100 transition outline-none placeholder:text-zinc-600 focus:border-blue-500/60"
            id="title"
            maxLength={200}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="输入任务标题"
            value={title}
          />
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            disabled={submitting}
            title="创建会话"
            type="submit"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="mt-6 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <span>任务列表</span>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-zinc-50"
          onClick={onRefresh}
          title="刷新"
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <SessionList
        onDelete={onDeleteSession}
        onSelect={onSelectSession}
        selectedId={selectedSessionId}
        state={sessions}
      />

      {actionError ? (
        <div className="mt-4 shrink-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {actionError}
        </div>
      ) : null}
    </aside>
  );
}
