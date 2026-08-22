import { Bot, MessageSquare, Plus, RefreshCw } from "lucide-react";

import SessionList from "./session-list";
import type { LoadState, SessionItem } from "@/types/sessions";

type AppSidebarProps = {
  actionError: string | null;
  onCreateSession: () => void | Promise<void>;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onSelectSession: (sessionId: string) => void;
  selectedSessionId: string | null;
  sessions: LoadState<SessionItem[]>;
  submitting: boolean;
  title: string;
  onTitleChange: (value: string) => void;
};

export default function AppSidebar({
  actionError,
  onCreateSession,
  onDeleteSession,
  onRefresh,
  onSelectSession,
  selectedSessionId,
  sessions,
  submitting,
  title,
  onTitleChange,
}: AppSidebarProps) {
  return (
    <aside className="border-r border-slate-200 bg-white px-4 py-5 max-lg:border-b max-lg:border-r-0">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
          <Bot size={22} aria-hidden="true" />
        </div>
        <div>
          <div className="text-base font-semibold leading-5">CurryAgent</div>
          <div className="mt-1 text-xs text-slate-500">Agent Workspace</div>
        </div>
      </div>

      <form
        className="mt-6 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateSession();
        }}
      >
        <label className="text-xs font-medium text-slate-500" htmlFor="title">
          新建会话
        </label>
        <div className="flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-slate-400"
            disabled={submitting}
            id="title"
            maxLength={200}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="输入任务标题"
            value={title}
          />
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting || !title.trim()}
            title="创建会话"
            type="submit"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare size={17} aria-hidden="true" />
          <span>会话列表</span>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          disabled={sessions.type === "loading"}
          onClick={() => void onRefresh()}
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
        <div
          className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}
    </aside>
  );
}
