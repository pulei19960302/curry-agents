import { Bot, MessageSquare, Plus, RefreshCw, Settings } from "lucide-react";

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
    <aside className="border-r border-slate-200 bg-white px-4 py-5 max-lg:border-r-0 max-lg:border-b">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
          <Bot size={22} aria-hidden="true" />
        </div>
        <div>
          <div className="text-base leading-5 font-semibold">CurryAgent</div>
          <div className="mt-1 text-xs text-slate-500">Agent Workspace</div>
        </div>
      </div>

      <nav className="mt-6 grid gap-2">
        <SidebarNavButton
          active={activeView === "workspace"}
          icon={MessageSquare}
          label="工作台"
          onClick={() => onViewChange("workspace")}
        />
        <SidebarNavButton
          active={activeView === "settings"}
          icon={Settings}
          label="设置"
          onClick={() => onViewChange("settings")}
        />
      </nav>

      <form
        className="mt-6 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateSession();
        }}
      >
        <label className="text-xs font-medium text-slate-500" htmlFor="title">
          新建会话
        </label>
        <div className="flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm transition outline-none focus:border-slate-400"
            id="title"
            maxLength={200}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="输入任务标题"
            value={title}
          />
          <button
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting}
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
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}
    </aside>
  );
}

function SidebarNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof MessageSquare;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
