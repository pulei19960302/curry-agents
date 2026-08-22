"use client";

import { CheckCircle2, Clock3, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AppSidebar from "./components/app-sidebar";
import SessionPanel from "./components/session-panel";
import StatusBadge from "./components/status-badge";
import StatusPanel from "./components/status-panel";
import TaskFlowPreview from "./components/task-flow-preview";
import { requestApi } from "./lib/api";
import type {
  LoadState,
  SessionItem,
  SessionListData,
  StatusBadgeView,
} from "@/types/sessions";

import type { ApiStatusData, DatabaseStatusData } from "@/types/api";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<LoadState<ApiStatusData>>({
    type: "loading",
  });
  const [databaseStatus, setDatabaseStatus] = useState<
    LoadState<DatabaseStatusData>
  >({ type: "loading" });
  const [sessions, setSessions] = useState<LoadState<SessionItem[]>>({
    type: "loading",
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadStatus() {
    const [apiData, databaseData] = await Promise.all([
      requestApi<ApiStatusData>("/api/status"),
      requestApi<DatabaseStatusData>("/api/status/database"),
    ]);
    setApiStatus({ type: "ready", data: apiData });
    setDatabaseStatus({ type: "ready", data: databaseData });
  }

  async function loadSessions() {
    const data = await requestApi<SessionListData>("/api/sessions");
    setSessions({ type: "ready", data: data.items });
    setSelectedSessionId((current) => {
      if (current && data.items.some((item) => item.id === current)) {
        return current;
      }
      return data.items[0]?.id ?? null;
    });
  }

  async function refreshAll() {
    setActionError(null);
    try {
      await Promise.all([loadStatus(), loadSessions()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setApiStatus((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setDatabaseStatus((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setSessions((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setActionError(message);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function handleCreateSession() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setActionError("请输入会话标题");
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const created = await requestApi<SessionItem>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: cleanTitle }),
      });
      setTitle("");
      setSelectedSessionId(created.id);
      await loadSessions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    setActionError(null);
    try {
      await requestApi<void>(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      await loadSessions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "unknown error");
    }
  }

  const sessionItems = sessions.type === "ready" ? sessions.data : [];
  const selectedSession = useMemo(
    () => sessionItems.find((item) => item.id === selectedSessionId) ?? null,
    [selectedSessionId, sessionItems],
  );

  const apiBadge = getBadge(apiStatus, "API 正常", "API 异常");
  const dbBadge = getBadge(databaseStatus, "数据库正常", "数据库异常");

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="grid min-h-screen grid-cols-[320px_1fr] max-lg:grid-cols-1">
        <AppSidebar
          actionError={actionError}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
          onRefresh={refreshAll}
          onSelectSession={setSelectedSessionId}
          onTitleChange={setTitle}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
          submitting={submitting}
          title={title}
        />

        <section className="flex min-w-0 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-6 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4 max-sm:py-4">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-slate-950">
                {selectedSession?.title ?? "工作台"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                创建会话后，后续章节会在这里展示聊天与事件流
              </p>
            </div>
            <div className="flex gap-2 max-sm:flex-wrap">
              <StatusBadge badge={apiBadge} />
              <StatusBadge badge={dbBadge} />
            </div>
          </header>

          <div className="grid gap-5 p-6 max-sm:p-4">
            <section className="grid grid-cols-[1fr_1fr] gap-5 max-xl:grid-cols-1">
              <StatusPanel
                apiStatus={apiStatus}
                databaseStatus={databaseStatus}
              />
              <SessionPanel selectedSession={selectedSession} />
            </section>

            <TaskFlowPreview />
          </div>
        </section>
      </div>
    </main>
  );
}

function getBadge<T>(
  state: LoadState<T>,
  readyLabel: string,
  errorLabel: string,
): StatusBadgeView {
  if (state.type === "ready") {
    return {
      label: readyLabel,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  if (state.type === "error") {
    return {
      label: errorLabel,
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: Wifi,
    };
  }
  return {
    label: "检测中",
    className: "border-slate-200 bg-white text-slate-600",
    icon: Clock3,
  };
}
