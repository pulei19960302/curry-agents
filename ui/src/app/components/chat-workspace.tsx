import ChatInput from "./chat-input";
import { EventTimeline } from "./event-timeline";
import MessageTimeline from "./message-timeline";
import type {
  ChatMessage,
  LoadState,
  SessionEventItem,
  SessionItem,
} from "@/types/sessions";

type ChatWorkspaceProps = {
  draft: string;
  events: LoadState<SessionEventItem[]>;
  messages: LoadState<ChatMessage[]>;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  selectedSession: SessionItem | null;
  sending: boolean;
};

export default function ChatWorkspace({
  draft,
  events,
  messages,
  onDraftChange,
  onSend,
  selectedSession,
  sending,
}: ChatWorkspaceProps) {
  return (
    <section className="grid grid-cols-[1fr_280px] gap-5 max-xl:grid-cols-1">
      <div className="flex min-h-[560px] flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <MessageTimeline state={messages} />
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

      <aside className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">事件记录</h2>
        <p className="mt-1 text-sm text-slate-500">本章先展示消息创建事件</p>
        <div className="mt-4">
          <EventTimeline state={events} />
        </div>
      </aside>
    </section>
  );
}
