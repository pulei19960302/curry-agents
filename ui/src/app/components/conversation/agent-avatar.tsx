import { Loader2, Bot } from "lucide-react";

export type AgentAvatarProps = {
  loading?: boolean;
};

// Agent 头像和 loading 状态
export default function AgentAvatar({ loading = false }: AgentAvatarProps) {
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center text-zinc-50">
      {loading ? (
        <Loader2 className="animate-spin text-blue-400" size={22} aria-hidden="true" />
      ) : (
        <Bot className="text-zinc-50" size={22} aria-hidden="true" />
      )}
    </div>
  );
}
