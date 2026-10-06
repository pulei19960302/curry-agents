import { useState } from "react";

import type { FilePreviewData } from "@/types/files";
import type { AgentPlan } from "@/types/planner";
import SessionControlBar from "@/components/session-control-bar";
import ConversationTimeline from "@/components/conversation-timeline";
import AttachmentUpload from "@/components/attachment-upload";
import AttachmentList from "@/components/attachment-list";
import ChatInput from "@/components/chat-input";
import ToolPreviewPanel from "@/components/tool-preview-panel";
import FilePreviewPanel from "@/components/file-preview-panel";
import ContextPanel from "@/components/context-panel";

import type {
  AgentTaskItem,
  ChatMessage,
  LoadState,
  SessionContextData,
  SessionEventItem,
  SessionFileItem,
  SessionItem,
} from "@/types/sessions";

type ChatWorkspaceProps = {
  attachments: SessionFileItem[];
  draft: string;
  clearingUnread: boolean;
  events: LoadState<SessionEventItem[]>;
  context: LoadState<SessionContextData | null>;
  filePreview: LoadState<FilePreviewData | null>;
  messages: LoadState<ChatMessage[]>;
  onClearUnread: () => void;
  onRefreshContext: () => void;
  onDraftChange: (value: string) => void;
  onPreviewFile: (fileId: string) => void;
  onSend: () => void;
  onSelectFile: (file: SessionFileItem | null) => void;
  onStop: () => void;
  onUploadFile: (file: File) => void;
  selectedFile: SessionFileItem | null;
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
  attachments,
  clearingUnread,
  context,
  draft,
  events,
  filePreview,
  messages,
  onClearUnread,
  onRefreshContext,
  onDraftChange,
  onPreviewFile,
  onSend,
  onSelectFile,
  onStop,
  onUploadFile,
  selectedFile,
  selectedSession,
  plan,
  task,
  planning,
  executingPlan,
  sending,
  stopping,
  uploadingFile,
}: ChatWorkspaceProps) {
  const [selectedToolEventId, setSelectedToolEventId] = useState<string | null>(null);
  const [showContextPreview, setShowContextPreview] = useState(false);
  const hasToolPreview = selectedToolEventId !== null;
  const hasFilePreview =
    !showContextPreview && selectedToolEventId === null && selectedFile !== null;
  const hasPreview = hasToolPreview || hasFilePreview || showContextPreview;

  function openFilePreview(file: SessionFileItem) {
    setShowContextPreview(false);
    setSelectedToolEventId(null);
    onSelectFile(file);
    onPreviewFile(file.file.id);
  }

  return (
    <section className="relative flex h-full min-h-0 gap-0 overflow-hidden bg-transparent max-xl:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.14),transparent_34%),linear-gradient(180deg,rgba(5,6,10,0.25),#05060a_78%)]" />
      <div
        className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden ${
          hasPreview ? "" : "mx-auto w-full max-w-[1080px]"
        }`}
      >
        <SessionControlBar
          clearingUnread={clearingUnread}
          onClearUnread={onClearUnread}
          onOpenContext={() => {
            setSelectedToolEventId(null);
            onSelectFile(null);
            setShowContextPreview(true);
            onRefreshContext();
          }}
          onStop={onStop}
          selectedSession={selectedSession}
          stopping={stopping}
        />
        <ConversationTimeline
          events={events}
          messages={messages}
          onSelectToolEvent={(eventId) => {
            setShowContextPreview(false);
            onSelectFile(null);
            setSelectedToolEventId(eventId);
          }}
          executing={executingPlan}
          plan={plan}
          planning={planning}
          selectedToolEventId={selectedToolEventId}
          task={task}
        />
        <div className="mt-auto shrink-0 bg-[#05060a]/85 px-8 py-4 backdrop-blur-2xl max-md:px-4">
          <div className="mx-auto mb-3 h-px w-[220px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <div className="mx-auto max-w-5xl">
            <div className="mb-2 flex flex-wrap items-center justify-start gap-2">
              <div className="flex items-center gap-3">
                <AttachmentUpload
                  disabled={!selectedSession}
                  onUpload={onUploadFile}
                  uploading={uploadingFile}
                />
                <AttachmentList files={attachments} onSelectFile={openFilePreview} />
              </div>
            </div>
          </div>
          <ChatInput
            disabled={!selectedSession}
            draft={draft}
            onDraftChange={onDraftChange}
            onSend={onSend}
            sending={sending || planning || executingPlan}
          />
        </div>
      </div>

      {hasToolPreview ? (
        <aside className="relative z-20 h-full w-[600px] shrink-0 border-l border-white/10 bg-[#07080d]/95 py-2 pr-2 shadow-2xl shadow-black/40 max-xl:h-[640px] max-xl:w-full">
          <ToolPreviewPanel
            events={events}
            onClose={() => setSelectedToolEventId(null)}
            selectedToolEventId={selectedToolEventId}
          />
        </aside>
      ) : null}
      {hasFilePreview ? (
        <aside className="relative z-20 h-full w-[600px] shrink-0 border-l border-white/10 bg-[#07080d]/95 py-2 pr-2 shadow-2xl shadow-black/40 max-xl:h-[640px] max-xl:w-full">
          <FilePreviewPanel
            onClose={() => onSelectFile(null)}
            onPreview={onPreviewFile}
            preview={filePreview}
            selectedFile={selectedFile}
          />
        </aside>
      ) : null}
      {showContextPreview ? (
        <aside className="relative z-20 h-full w-[600px] shrink-0 border-l border-white/10 bg-[#07080d]/95 py-2 pr-2 shadow-2xl shadow-black/40 max-xl:h-[720px] max-xl:w-full">
          <ContextPanel
            context={context}
            disabled={!selectedSession}
            onClose={() => setShowContextPreview(false)}
            onRefresh={onRefreshContext}
          />
        </aside>
      ) : null}
    </section>
  );
}
