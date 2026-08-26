"use client";

import { CheckCircle2, Clock3, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import AppSidebar from "./components/app-sidebar";
import ChatWorkspace from "./components/chat-workspace";
import SessionPanel from "./components/session-panel";
import StatusBadge from "./components/status-badge";
import StatusPanel from "./components/status-panel";
import useSessionWorkspace from "./hooks/use-session-workspace";
import { requestApi } from "@/lib/api";
import type { LoadState, StatusBadgeView } from "@/types/sessions";

import type { ApiStatusData, DatabaseStatusData } from "@/types/api";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<LoadState<ApiStatusData>>({
    type: "loading",
  });
  const [databaseStatus, setDatabaseStatus] = useState<
    LoadState<DatabaseStatusData>
  >({ type: "loading" });

  const workspace = useSessionWorkspace();

  async function loadStatus() {
    const [apiData, databaseData] = await Promise.all([
      requestApi<ApiStatusData>("/api/status"),
      requestApi<DatabaseStatusData>("/api/status/database"),
    ]);
    setApiStatus({ type: "ready", data: apiData });
    setDatabaseStatus({ type: "ready", data: databaseData });
  }

  async function refreshAll() {
    workspace.setActionError(null);
    try {
      await Promise.all([loadStatus(), workspace.refreshSessions()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setApiStatus((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setDatabaseStatus((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      workspace.setActionError(message);
    }
  }

  useEffect(() => {
    loadStatus().catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      setApiStatus({ type: "error", message });
      setDatabaseStatus({ type: "error", message });
    });
  }, []);

  const apiBadge = getBadge(apiStatus, "API 正常", "API 异常");
  const dbBadge = getBadge(databaseStatus, "数据库正常", "数据库异常");

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="grid min-h-screen grid-cols-[320px_1fr] max-lg:grid-cols-1">
        <AppSidebar
          actionError={workspace.actionError}
          onCreateSession={workspace.createSession}
          onDeleteSession={workspace.deleteSession}
          onRefresh={refreshAll}
          onSelectSession={workspace.selectSession}
          onTitleChange={workspace.setTitle}
          selectedSessionId={workspace.selectedSessionId}
          sessions={workspace.sessions}
          submitting={workspace.submitting}
          title={workspace.title}
        />

        <section className="flex min-w-0 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-6 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4 max-sm:py-4">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-slate-950">
                {workspace.selectedSession?.title ?? "工作台"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                创建会话后，可以发送第一条任务消息
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
              <SessionPanel selectedSession={workspace.selectedSession} />
            </section>

            <ChatWorkspace
              attachments={workspace.attachments}
              clearingUnread={workspace.clearingUnread}
              draft={workspace.draft}
              events={workspace.events}
              files={workspace.files}
              filePreview={workspace.filePreview}
              messages={workspace.messages}
              onClearUnread={workspace.clearUnread}
              onDraftChange={workspace.setDraft}
              onPreviewFile={workspace.loadFilePreview}
              onSend={workspace.sendMessage}
              onSelectFile={workspace.selectFile}
              onStop={workspace.stopSession}
              onUploadFile={workspace.uploadAttachment}
              selectedFile={workspace.selectedFile}
              selectedSession={workspace.selectedSession}
              sending={workspace.sendingMessage}
              stopping={workspace.stoppingSession}
              uploadingFile={workspace.uploadingFile}
            />
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
