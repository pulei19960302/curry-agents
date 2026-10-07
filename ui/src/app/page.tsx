"use client";

import { CheckCircle2, Clock3, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

import AppSidebar from "./components/app-sidebar";
import ChatWorkspace from "./components/chat-workspace";
import SettingsWorkspace from "./components/settings-workspace";
import StatusBadge from "./components/status-badge";
import useSessionWorkspace from "./hooks/use-session-workspace";
import { fetchA2aAgentCard, fetchA2aAgents, fetchA2aConcepts } from "./lib/a2a-api";
import { requestApi } from "./lib/api";
import { fetchMcpServers, fetchMcpTools } from "./lib/mcp-api";
import { fetchMultiAgentRoles } from "./lib/multi-agent-api";
import { fetchCurrentSandbox, fetchVncStatus, waitCurrentSandbox } from "./lib/sandbox-api";
import {
  createSettingsIntegration,
  deleteSettingsIntegration,
  fetchAppSettings,
  updateSettingsModule,
} from "./lib/settings-api";

import type { LoadState, StatusBadgeView } from "@/types/sessions";
import type { A2aAgentCardData, A2aRemoteAgentListData, A2aConceptsData } from "@/types/a2a";
import type { McpServerListData, McpToolListData } from "@/types/mcp";
import type { MultiAgentRoleListData } from "@/types/mutil-agent";
import type { SandboxInstanceData } from "@/types/sandbox";
import type { VncStatusData } from "@/types/vnc";
import type { ApiStatusData, DatabaseStatusData } from "./types/api";
import { AppSettingsData } from "./types/setting";

export default function Home() {
  const [activeView, setActiveView] = useState<"workspace" | "settings">("workspace");
  // API、数据库、Sandbox 都属于工作台的基础健康状态。
  // 它们分开保存，方便某一项失败时只让对应面板进入 error 状态。
  const [apiStatus, setApiStatus] = useState<LoadState<ApiStatusData>>({
    type: "loading",
  });
  const [databaseStatus, setDatabaseStatus] = useState<LoadState<DatabaseStatusData>>({
    type: "loading",
  });
  const [sandboxStatus, setSandboxStatus] = useState<LoadState<SandboxInstanceData>>({
    type: "loading",
  });
  const [vncStatus, setVncStatus] = useState<LoadState<VncStatusData>>({
    type: "loading",
  });
  const [mcpServers, setMcpServers] = useState<LoadState<McpServerListData>>({ type: "loading" });
  const [mcpTools, setMcpTools] = useState<LoadState<McpToolListData>>({
    type: "loading",
  });
  const [a2aConcepts, setA2aConcepts] = useState<LoadState<A2aConceptsData>>({ type: "loading" });
  const [a2aAgentCard, setA2aAgentCard] = useState<LoadState<A2aAgentCardData>>({
    type: "loading",
  });
  const [a2aAgents, setA2aAgents] = useState<LoadState<A2aRemoteAgentListData>>({
    type: "loading",
  });
  const [multiAgentRoles, setMultiAgentRoles] = useState<LoadState<MultiAgentRoleListData>>({
    type: "loading",
  });
  const [appSettings, setAppSettings] = useState<LoadState<AppSettingsData>>({
    type: "loading",
  });
  const [sandboxRefreshing, setSandboxRefreshing] = useState(false);
  const workspace = useSessionWorkspace();

  async function loadStatus() {
    // 页面初始化时一次性读取三类状态：
    // 1. API 自身是否运行
    // 2. 数据库是否可连接
    // 3. 当前任务沙箱是否可用
    // 这里请求的是主 API 暴露的 /api/sandboxes/current，
    // 前端不直接访问 sandbox-api，避免把内部服务地址暴露给浏览器。
    const [
      apiData,
      databaseData,
      sandboxData,
      vncData,
      mcpServerData,
      mcpToolData,
      a2aConceptData,
      a2aCardData,
      a2aAgentData,
      multiAgentRoleData,
      appSettingsData,
    ] = await Promise.all([
      requestApi<ApiStatusData>("/api/status"),
      requestApi<DatabaseStatusData>("/api/status/database"),
      fetchCurrentSandbox(),
      fetchVncStatus(),
      fetchMcpServers(),
      fetchMcpTools(),
      fetchA2aConcepts(),
      fetchA2aAgentCard(),
      fetchA2aAgents(),
      fetchMultiAgentRoles(),
      fetchAppSettings(),
    ]);
    setApiStatus({ type: "ready", data: apiData });
    setDatabaseStatus({ type: "ready", data: databaseData });
    setSandboxStatus({ type: "ready", data: sandboxData });
    setVncStatus({ type: "ready", data: vncData });
    setMcpServers({ type: "ready", data: mcpServerData });
    setMcpTools({ type: "ready", data: mcpToolData });
    setA2aConcepts({ type: "ready", data: a2aConceptData });
    setA2aAgentCard({ type: "ready", data: a2aCardData });
    setA2aAgents({ type: "ready", data: a2aAgentData });
    setMultiAgentRoles({ type: "ready", data: multiAgentRoleData });
    setAppSettings({ type: "ready", data: appSettingsData });
  }

  async function refreshAll() {
    // 左侧刷新按钮负责刷新“工作台整体状态”。
    // 会话列表和健康状态一起刷新，避免页面显示旧会话但状态已经变化。
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
      setVncStatus((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setMcpServers((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setMcpTools((current) => (current.type === "loading" ? { type: "error", message } : current));
      setA2aConcepts((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setA2aAgentCard((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setA2aAgents((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setMultiAgentRoles((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      setAppSettings((current) =>
        current.type === "loading" ? { type: "error", message } : current,
      );
      workspace.setActionError(message);
    }
  }

  function refreshContext() {
    // 上下文数据只和当前会话相关，没有选中会话时不发请求。
    if (workspace.selectedSessionId) {
      workspace.loadSessionContext(workspace.selectedSessionId);
    }
  }

  useEffect(() => {
    loadStatus().catch((error) => {
      const message = error instanceof Error ? error.message : "unknown error";
      setApiStatus({ type: "error", message });
      setDatabaseStatus({ type: "error", message });
      setSandboxStatus({ type: "error", message });
      setVncStatus({ type: "error", message });
      setMcpServers({ type: "error", message });
      setMcpTools({ type: "error", message });
      setA2aConcepts({ type: "error", message });
      setA2aAgentCard({ type: "error", message });
      setA2aAgents({ type: "error", message });
      setMultiAgentRoles({ type: "error", message });
      setAppSettings({ type: "error", message });
    });
  }, []);

  async function refreshSandbox() {
    // 任务沙箱刷新按钮不只是重新读取状态，而是调用 wait 接口等待它变健康。
    // 这样 Docker 刚启动、Sandbox 还在初始化时，用户点刷新有机会直接等到 ready。
    setSandboxRefreshing(true);
    try {
      const sandbox = await waitCurrentSandbox();
      setSandboxStatus({ type: "ready", data: sandbox });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setSandboxStatus({ type: "error", message });
    } finally {
      setSandboxRefreshing(false);
    }
  }

  async function refreshVnc() {
    setVncStatus({ type: "loading" });
    try {
      const vnc = await fetchVncStatus();
      setVncStatus({ type: "ready", data: vnc });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setVncStatus({ type: "error", message });
    }
  }

  async function refreshMcp() {
    setMcpServers({ type: "loading" });
    setMcpTools({ type: "loading" });
    try {
      const [servers, tools] = await Promise.all([fetchMcpServers(), fetchMcpTools()]);
      setMcpServers({ type: "ready", data: servers });
      setMcpTools({ type: "ready", data: tools });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setMcpServers({ type: "error", message });
      setMcpTools({ type: "error", message });
    }
  }

  async function refreshA2a() {
    setA2aConcepts({ type: "loading" });
    setA2aAgentCard({ type: "loading" });
    setA2aAgents({ type: "loading" });
    try {
      const [concepts, agentCard, agents] = await Promise.all([
        fetchA2aConcepts(),
        fetchA2aAgentCard(),
        fetchA2aAgents(),
      ]);
      setA2aConcepts({ type: "ready", data: concepts });
      setA2aAgentCard({ type: "ready", data: agentCard });
      setA2aAgents({ type: "ready", data: agents });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setA2aConcepts({ type: "error", message });
      setA2aAgentCard({ type: "error", message });
      setA2aAgents({ type: "error", message });
    }
  }

  async function refreshMultiAgent() {
    setMultiAgentRoles({ type: "loading" });
    try {
      const roles = await fetchMultiAgentRoles();
      setMultiAgentRoles({ type: "ready", data: roles });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setMultiAgentRoles({ type: "error", message });
    }
  }

  async function refreshSettings() {
    setAppSettings({ type: "loading" });
    try {
      const settings = await fetchAppSettings();
      setAppSettings({ type: "ready", data: settings });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setAppSettings({ type: "error", message });
    }
  }

  async function toggleSettingsModule(moduleKey: string, enabled: boolean) {
    try {
      await updateSettingsModule(moduleKey, { enabled });
      await refreshSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setAppSettings({ type: "error", message });
    }
  }

  async function addSettingsIntegration(payload: {
    kind: string;
    name: string;
    description: string;
    endpoint: string;
  }) {
    try {
      await createSettingsIntegration(payload);
      await refreshSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setAppSettings({ type: "error", message });
    }
  }

  async function removeSettingsIntegration(integrationId: string) {
    try {
      await deleteSettingsIntegration(integrationId);
      await refreshSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      setAppSettings({ type: "error", message });
    }
  }

  const apiBadge = getBadge(apiStatus, "API 正常", "API 异常");
  const dbBadge = getBadge(databaseStatus, "数据库正常", "数据库异常");

  return (
    <main className="h-screen overflow-hidden bg-[#050506] text-zinc-50">
      <div className="grid h-full min-h-0 grid-cols-[300px_1fr] max-lg:grid-cols-1">
        <AppSidebar
          actionError={workspace.actionError}
          activeView={activeView}
          onCreateSession={workspace.createSession}
          onDeleteSession={workspace.deleteSession}
          onRefresh={refreshAll}
          onSelectSession={workspace.selectSession}
          onViewChange={setActiveView}
          onTitleChange={workspace.setTitle}
          selectedSessionId={workspace.selectedSessionId}
          sessions={workspace.sessions}
          submitting={workspace.submitting}
          title={workspace.title}
        />

        <section className="agent-grid-bg flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#05060a]">
          {activeView === "settings" ? (
            <header className="flex min-h-24 items-center justify-between border-b border-white/10 bg-[#05060a]/80 px-8 backdrop-blur-2xl max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4 max-sm:py-4">
              <div>
                <div className="mb-2 text-xs font-medium tracking-[0.2em] text-blue-400/80 uppercase">
                  Control Center
                </div>
                <h1 className="text-3xl font-semibold tracking-normal text-zinc-50 max-sm:text-2xl">
                  设置
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  集中管理模型、工具、远程 Agent 和多 Agent 配置
                </p>
              </div>
              <div className="flex gap-2 max-sm:flex-wrap">
                <StatusBadge badge={apiBadge} />
                <StatusBadge badge={dbBadge} />
              </div>
            </header>
          ) : null}

          <div
            className={`min-h-0 flex-1 overflow-hidden ${
              activeView === "workspace" ? "p-0" : "p-5 max-md:p-3"
            }`}
          >
            {activeView === "workspace" ? (
              <ChatWorkspace
                a2aAgentCard={a2aAgentCard}
                a2aAgents={a2aAgents}
                a2aConcepts={a2aConcepts}
                attachments={workspace.attachments}
                clearingUnread={workspace.clearingUnread}
                context={workspace.context}
                draft={workspace.draft}
                events={workspace.events}
                files={workspace.files}
                filePreview={workspace.filePreview}
                messages={workspace.messages}
                onClearUnread={workspace.clearUnread}
                onDraftChange={workspace.setDraft}
                onPreviewFile={workspace.loadFilePreview}
                onRefreshA2a={refreshA2a}
                onRefreshContext={refreshContext}
                onRefreshMcp={refreshMcp}
                onRefreshMultiAgent={refreshMultiAgent}
                onRefreshSandbox={refreshSandbox}
                onRefreshVnc={refreshVnc}
                onSend={workspace.sendMessage}
                onSelectFile={workspace.selectFile}
                onStop={workspace.stopSession}
                onUploadFile={workspace.uploadAttachment}
                executingPlan={workspace.executingPlan}
                plan={workspace.latestPlan}
                planning={workspace.planning}
                task={workspace.currentTask}
                mcpServers={mcpServers}
                mcpTools={mcpTools}
                multiAgentRoles={multiAgentRoles}
                sandbox={sandboxStatus}
                sandboxRefreshing={sandboxRefreshing}
                vnc={vncStatus}
                selectedFile={workspace.selectedFile}
                selectedSession={workspace.selectedSession}
                sending={workspace.sendingMessage}
                stopping={workspace.stoppingSession}
                uploadingFile={workspace.uploadingFile}
              />
            ) : (
              <SettingsWorkspace
                onCreateIntegration={addSettingsIntegration}
                onDeleteIntegration={removeSettingsIntegration}
                onRefresh={refreshSettings}
                onToggleModule={toggleSettingsModule}
                settings={appSettings}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getBadge<T>(state: LoadState<T>, readyLabel: string, errorLabel: string): StatusBadgeView {
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
