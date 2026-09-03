import AttachmentList from "./attachment-list";
import AttachmentUpload from "./attachment-upload";
import ChatInput from "./chat-input";
import EventTimeline from "./event-timeline";
import MessageTimeline from "./message-timeline";
import SessionControlBar from "./session-control-bar";
import SessionFilePanel from "./session-file-panel";
import PlanPanel from "./plan-panel";
import type {
  AgentTaskItem,
  ChatMessage,
  LoadState,
  SessionContextData,
  SessionEventItem,
  SessionFileItem,
  SessionItem,
} from "@/types/sessions";

import type { FilePreviewData } from "@/types/files";

import type { AgentPlan } from "@/types/planner";
import ContextPanel from "@/components/context-panel";

type ChatWorkspaceProps = {
  attachments: SessionFileItem[];
  draft: string;
  clearingUnread: boolean;
  events: LoadState<SessionEventItem[]>;
  files: LoadState<SessionFileItem[]>;
  filePreview: LoadState<FilePreviewData | null>;
  messages: LoadState<ChatMessage[]>;
  onClearUnread: () => void;
  onCancelTask: () => void;
  onDraftChange: (value: string) => void;
  onPreviewFile: (fileId: string) => void;
  onSend: () => void;
  onSelectFile: (file: SessionFileItem) => void;
  onStop: () => void;
  onUploadFile: (file: File) => void;
  onCreatePlan: () => void;
  onExecutePlan: () => void;
  selectedFile: SessionFileItem | null;
  selectedSession: SessionItem | null;
  sending: boolean;
  stopping: boolean;
  uploadingFile: boolean;
  plan: AgentPlan | null;
  planning: boolean;
  executingPlan: boolean;
  task: AgentTaskItem | null;
  context: LoadState<SessionContextData | null>;
  onRefreshContext: () => void;
};

export default function ChatWorkspace({
  attachments,
  clearingUnread,
  draft,
  events,
  files,
  filePreview,
  messages,
  onCancelTask,
  onClearUnread,
  onDraftChange,
  onPreviewFile,
  onSend,
  onSelectFile,
  onStop,
  onUploadFile,
  onCreatePlan,
  onExecutePlan,
  selectedFile,
  selectedSession,
  sending,
  stopping,
  uploadingFile,
  plan,
  planning,
  executingPlan,
  task,
  context,
  onRefreshContext,
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
          onCancelTask={onCancelTask}
          onCreatePlan={onCreatePlan}
          onExecutePlan={onExecutePlan}
          plan={plan}
          planning={planning}
          task={task}
        />
        <SessionFilePanel
          files={files}
          onPreview={onPreviewFile}
          onSelectFile={onSelectFile}
          preview={filePreview}
          selectedFile={selectedFile}
        />
        <ContextPanel context={context} disabled={!selectedSession} onRefresh={onRefreshContext} />
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">事件记录</h2>
          <p className="mt-1 text-sm text-slate-500">本章先展示消息创建事件</p>
          <div className="mt-4">
            <EventTimeline state={events} />
          </div>
        </div>
      </aside>
    </section>
  );
}
