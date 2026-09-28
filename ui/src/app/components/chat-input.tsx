import { Loader2, Pause, SendHorizontal } from "lucide-react";

export type ChatInputProps = {
  disabled: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
};

export default function ChatInput({
  disabled,
  draft,
  onDraftChange,
  onSend,
  sending,
}: ChatInputProps) {
  return (
    <form
      className="mx-auto max-w-5xl"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="rounded-[28px] border border-blue-500/20 bg-black/70 p-4 shadow-2xl shadow-blue-950/20">
        <textarea
          className="max-h-44 min-h-24 w-full resize-none border-0 bg-transparent px-2 py-2 text-xl leading-8 font-semibold text-zinc-100 outline-none placeholder:text-zinc-600 disabled:bg-transparent"
          disabled={disabled || sending}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={disabled ? "先创建或选择一个任务" : "分配一个任务或提问任何问题..."}
          value={draft}
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-zinc-600">Enter 发送任务，执行过程会在上方实时展开</div>
          <button
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-zinc-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:text-zinc-600"
            disabled={disabled || sending}
            title="发送并开始执行"
            type="submit"
          >
            {sending ? (
              <Loader2 className="animate-spin" size={21} aria-hidden="true" />
            ) : draft.trim() ? (
              <SendHorizontal size={21} aria-hidden="true" />
            ) : (
              <Pause size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
