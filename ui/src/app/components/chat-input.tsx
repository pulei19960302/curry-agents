import { SendHorizontal } from "lucide-react";

export type ChatInputProps = {
  disabled: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
};

const ChatInput = ({
  disabled,
  draft,
  onDraftChange,
  onSend,
  sending,
}: ChatInputProps) => {
  return (
    <form
      className="border-t border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="flex items-end gap-3">
        <textarea
          className="min-h-20 flex-1 resize-none rounded-md border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-50"
          disabled={disabled || sending}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={disabled ? "先创建或选择一个会话" : "输入任务内容"}
          value={draft}
        />
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled || sending}
          title="发送消息"
          type="submit"
        >
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
};

export default ChatInput;
