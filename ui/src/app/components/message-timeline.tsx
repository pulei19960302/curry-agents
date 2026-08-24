import { Bot, UserRound } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { ChatMessage, LoadState } from "@/types/sessions";

export default function MessageTimeline({
  state,
}: {
  state: LoadState<ChatMessage[]>;
}) {
  if (state.type === "loading") {
    return <div className="p-5 text-sm text-slate-500">消息加载中...</div>;
  }

  if (state.type === "error") {
    return (
      <div className="m-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {state.message}
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-5 text-sm text-slate-500">
        暂无消息，发送第一条任务内容
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-5">
      {state.data.map((message) => {
        const isUser = message.role === "user";
        const Icon = isUser ? UserRound : Bot;

        return (
          <div
            className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
            key={message.id}
          >
            {!isUser ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Icon size={16} aria-hidden="true" />
              </div>
            ) : null}
            <div
              className={`max-w-[70%] rounded-md px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              <div
                className={`mt-2 text-xs ${
                  isUser ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {formatDate(message.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
