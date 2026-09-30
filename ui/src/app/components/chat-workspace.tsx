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
  context: LoadState<SessionContextData>;
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
    <section className="flex h-[calc(100vh-80px)] min-h-[720px] gap-0 overflow-hidden max-xl:h-auto max-xl:flex-col">
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          hasPreview ? "" : "mx-auto w-full"
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
        <div className="mt-auto border-t border-white/10 bg-black/45 px-8 py-5 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl space-y-3">
            <AttachmentUpload
              disabled={!selectedSession}
              onUpload={onUploadFile}
              uploading={uploadingFile}
            />
            <AttachmentList files={attachments} onSelectFile={openFilePreview} />
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
        <aside className="h-full w-[560px] shrink-0 border-l border-white/10 bg-black/75 max-xl:h-[640px] max-xl:w-full">
          <ToolPreviewPanel
            events={events}
            onClose={() => setSelectedToolEventId(null)}
            selectedToolEventId={selectedToolEventId}
          />
        </aside>
      ) : null}
      {hasFilePreview ? (
        <aside className="h-full w-[560px] shrink-0 border-l border-white/10 bg-black/75 max-xl:h-[640px] max-xl:w-full">
          <FilePreviewPanel
            onClose={() => onSelectFile(null)}
            onPreview={onPreviewFile}
            preview={filePreview}
            selectedFile={selectedFile}
          />
        </aside>
      ) : null}
      {showContextPreview ? (
        <aside className="h-full w-[560px] shrink-0 border-l border-white/10 bg-black/75 max-xl:h-[720px] max-xl:w-full">
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
