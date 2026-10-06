import { ChatMessage } from "@/types/sessions";
import AgentAvatar from "./agent-avatar";

export type MessageBubbleProps = {
  message: ChatMessage;
};

// 展示用户消息和 AI 消息
export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end pt-2">
        <div className="max-w-[80%] rounded-2xl border border-white/10 bg-[#151722]/90 px-5 py-3 text-base leading-7 font-semibold text-zinc-50 shadow-xl shadow-black/25 max-md:max-w-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div className="max-w-4xl pt-1">
        <div className="text-base font-semibold text-blue-400">CurryAgent</div>
        <p className="mt-3 text-base leading-8 whitespace-pre-wrap text-zinc-400">
          {message.content}
        </p>
      </div>
    </div>
  );
}
