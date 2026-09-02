import { GitBranch, Loader2, Play, Sparkles, Square } from "lucide-react";

import type { AgentTaskItem } from "@/types/sessions";
import type { AgentPlan } from "@/types/planner";

type PlanPanelProps = {
  disabled: boolean;
  executing: boolean;
  onCancelTask: () => void;
  onCreatePlan: () => void;
  onExecutePlan: () => void;
  plan: AgentPlan | null;
  planning: boolean;
  task: AgentTaskItem | null;
};

export default function PlanPanel({
  disabled,
  executing,
  onCancelTask,
  onCreatePlan,
  onExecutePlan,
  plan,
  planning,
  task,
}: PlanPanelProps) {
  const canCancelTask =
    task !== null && !["succeeded", "failed", "cancelled"].includes(task.status);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">计划面板</h2>
          <p className="mt-1 text-sm text-slate-500">
            根据当前任务生成 PlannerAgent 步骤
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={disabled || planning || executing}
            onClick={onCreatePlan}
            type="button"
          >
            {planning ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            生成
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-950 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
            disabled={disabled || !plan || executing || planning}
            onClick={onExecutePlan}
            type="button"
          >
            {executing ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <Play size={15} />
            )}
            执行
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!canCancelTask}
            onClick={onCancelTask}
            type="button"
          >
            <Square size={15} />
            取消
          </button>
        </div>
      </div>

      {task ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <div className="font-medium text-slate-900">后台任务：{task.status}</div>
          <div className="mt-1 break-all">任务 ID：{task.id}</div>
          {task.error ? (
            <div className="mt-1 text-rose-600">错误：{task.error}</div>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <div className="mt-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <GitBranch size={16} aria-hidden="true" />
              {plan.title}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{plan.goal}</p>
            <p className="mt-2 text-xs text-slate-500">来源：{plan.source}</p>
          </div>

          <ol className="mt-3 grid gap-3">
            {plan.steps.map((step, index) => (
              <li
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
                key={step.id}
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {step.title}
                    </div>
                    <span className="mt-1 inline-flex rounded bg-white px-2 py-0.5 text-xs text-slate-500">
                      {step.status}
                    </span>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {step.description}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      预期输出：{step.expected_output}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          输入任务后点击生成，这里会出现结构化计划。
        </div>
      )}
    </div>
  );
}