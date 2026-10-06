import { AgentTaskItem } from "@/types/sessions";
import { Sparkles } from "lucide-react";
import AgentAvatar from "./agent-avatar";

export type ErrorBlockProps = {
  message: string;
};

type RunningBlockProps = {
  text: string;
};

type TaskStatusCardProps = {
  task: AgentTaskItem | null;
};

// 空状态
export function TimelineEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-10 text-center">
      <div className="max-w-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl border border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-2xl shadow-blue-950/30">
          <Sparkles size={22} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-zinc-100">
          直接描述任务，Agent 会开始规划和执行
        </h2>
        <p className="mt-3 text-base leading-7 text-zinc-500">
          对话区会连续展示任务理解、执行计划、步骤进度、工具调用和最终结果；需要查看细节时，点击工具节点打开右侧工作台。
        </p>
      </div>
    </div>
  );
}

export function TimelineLoadingState() {
  return <div className="flex-1 px-8 py-8 text-sm text-zinc-500">对话加载中...</div>;
}

// 错误状态
export function ErrorBlock({ message }: ErrorBlockProps) {
  return (
    <div className="m-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {message}
    </div>
  );
}

export function TaskStatusCard({ task }: TaskStatusCardProps) {
  if (!task || ["completed", "succeeded", "failed", "stopped", "cancelled"].includes(task.status)) {
    return null;
  }

  return (
    <RunningBlock
      text={
        task.status === "waiting"
          ? "后台任务等待外部资源或人工继续"
          : `后台任务正在执行：${task.status}`
      }
    />
  );
}

export function RunningBlock({ text }: RunningBlockProps) {
  return (
    <div className="flex gap-4">
      <AgentAvatar loading={true} />
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-base font-semibold text-blue-200 shadow-2xl shadow-blue-950/20">
        {text}
      </div>
    </div>
  );
}
