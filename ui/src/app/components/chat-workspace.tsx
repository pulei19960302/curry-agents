import AttachmentList from "./attachment-list";
import AttachmentUpload from "./attachment-upload";
import ChatInput from "./chat-input";
import ContextPanel from "./context-panel";
import EventTimeline from "./event-timeline";
import MessageTimeline from "./message-timeline";
import PlanPanel from "./plan-panel";
import SessionControlBar from "./session-control-bar";
import ToolPreviewPanel from "./tool-preview-panel";
import type {
  AgentTaskItem,
  ChatMessage,
  LoadState,
  SessionContextData,
  SessionEventItem,
  SessionFileItem,
  SessionItem,
} from "@/types/sessions";

import type { A2aAgentCardData, A2aConceptsData, A2aRemoteAgentListData } from "@/types/a2a";
import type { FilePreviewData } from "@/types/files";
import type { McpServerListData, McpToolListData } from "@/types/mcp";
import type { MultiAgentRoleListData } from "@/types/mutil-agent";
import type { AgentPlan } from "@/types/planner";
import type { VncStatusData } from "@/types/vnc";
import type { SandboxInstanceData } from "@/types/sandbox";

type ChatWorkspaceProps = {
  a2aAgentCard: LoadState<A2aAgentCardData>;
  a2aAgents: LoadState<A2aRemoteAgentListData>;
  a2aConcepts: LoadState<A2aConceptsData>;
  attachments: SessionFileItem[];
  draft: string;
  clearingUnread: boolean;
  events: LoadState<SessionEventItem[]>;
  context: LoadState<SessionContextData | null>;
  files: LoadState<SessionFileItem[]>;
  filePreview: LoadState<FilePreviewData | null>;
  messages: LoadState<ChatMessage[]>;
  onClearUnread: () => void;
  onCancelPlanTask: () => void;
  onCreatePlan: () => void;
  onExecutePlan: () => void;
  onRefreshContext: () => void;
  onRefreshMcp: () => void;
  onRefreshMultiAgent: () => void;
  onRefreshSandbox: () => void;
  onRefreshVnc: () => void;
  onDraftChange: (value: string) => void;
  onPreviewFile: (fileId: string) => void;
  onRefreshA2a: () => void;
  onSend: () => void;
  onSelectFile: (file: SessionFileItem) => void;
  onStop: () => void;
  onUploadFile: (file: File) => void;
  selectedFile: SessionFileItem | null;
  mcpServers: LoadState<McpServerListData>;
  mcpTools: LoadState<McpToolListData>;
  multiAgentRoles: LoadState<MultiAgentRoleListData>;
  sandbox: LoadState<SandboxInstanceData>;
  sandboxRefreshing: boolean;
  vnc: LoadState<VncStatusData>;
  selectedSession: SessionItem | null;
  plan: AgentPlan | null;
  task: AgentTaskItem | null;
  planning: boolean;
  executingPlan: boolean;
  sending: boolean;
  stopping: boolean;
  uploadingFile: boolean;
};

export default function ChatWorkspace({
  a2aAgentCard,
  a2aAgents,
  a2aConcepts,
  attachments,
  clearingUnread,
  context,
  draft,
  events,
  files,
  filePreview,
  messages,
  onClearUnread,
  onCancelPlanTask,
  onCreatePlan,
  onExecutePlan,
  onRefreshContext,
  onRefreshMcp,
  onRefreshMultiAgent,
  onRefreshSandbox,
  onRefreshVnc,
  onDraftChange,
  onPreviewFile,
  onRefreshA2a,
  onSend,
  onSelectFile,
  onStop,
  onUploadFile,
  selectedFile,
  mcpServers,
  mcpTools,
  multiAgentRoles,
  sandbox,
  sandboxRefreshing,
  vnc,
  selectedSession,
  plan,
  task,
  planning,
  executingPlan,
  sending,
  stopping,
  uploadingFile,
}: ChatWorkspaceProps) {
  return (
    <section className="grid grid-cols-[1fr_280px] gap-5 max-xl:grid-cols-1">
      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <SessionControlBar
          clearingUnread={clearingUnread}
          onClearUnread={onClearUnread}
          onStop={onStop}
          selectedSession={selectedSession}
          stopping={stopping}
        />
        <MessageTimeline state={messages} />
        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
          <AttachmentUpload
            disabled={!selectedSession}
            onUpload={onUploadFile}
            uploading={uploadingFile}
          />
          <AttachmentList files={attachments.map((item) => item.file)} />
        </div>
        <div className="mt-auto">
          <ChatInput
            disabled={!selectedSession}
            draft={draft}
            onDraftChange={onDraftChange}
            onSend={onSend}
            sending={sending}
          />
        </div>
      </div>

      <aside className="space-y-5">
        <PlanPanel
          disabled={!selectedSession}
          executing={executingPlan}
          onCancelTask={onCancelPlanTask}
          onCreatePlan={onCreatePlan}
          onExecutePlan={onExecutePlan}
          plan={plan}
          planning={planning}
          task={task}
        />
        <ToolPreviewPanel
          a2aAgentCard={a2aAgentCard}
          a2aAgents={a2aAgents}
          a2aConcepts={a2aConcepts}
          events={events}
          files={files}
          onPreviewFile={onPreviewFile}
          onRefreshA2a={onRefreshA2a}
          onRefreshMcp={onRefreshMcp}
          onRefreshMultiAgent={onRefreshMultiAgent}
          onRefreshSandbox={onRefreshSandbox}
          onRefreshVnc={onRefreshVnc}
          onSelectFile={onSelectFile}
          preview={filePreview}
          mcpServers={mcpServers}
          mcpTools={mcpTools}
          multiAgentRoles={multiAgentRoles}
          sandbox={sandbox}
          sandboxRefreshing={sandboxRefreshing}
          selectedFile={selectedFile}
          vnc={vnc}
        />
        <ContextPanel context={context} disabled={!selectedSession} onRefresh={onRefreshContext} />
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">事件记录</h2>
          <p className="mt-1 text-sm text-slate-500">展示消息、计划和步骤执行事件</p>
          <div className="mt-4">
            <EventTimeline state={events} />
          </div>
        </div>
      </aside>
    </section>
  );
}
