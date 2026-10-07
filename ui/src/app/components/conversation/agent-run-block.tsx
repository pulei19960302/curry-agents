import { useMemo, useState } from "react";

import { ChevronUp, ChevronDown, AlertCircle, Loader2, Check } from "lucide-react";
import { buildStepViews, parseToolOutput } from "./view-model";
import AgentAvatar from "./agent-avatar";
import StepCard from "./step-card";
import { parseString } from "@/utils";

import type { SessionEventItem } from "@/types/sessions";
import type { PlanStepView } from "@/components/conversation/types";
import type { AgentPlan } from "@/types/planner";
import MarkdownContent from "../markdown-content";

export type AgentRunBlockProps = {
  events: SessionEventItem[];
  finalEvent: SessionEventItem | null;
  onSelectToolEvent: (eventId: string) => void;
  onOpenStep: (step: PlanStepView) => void;
  plan: AgentPlan;
  planning: boolean;
  selectedToolEventId: string | null;
};

export default function AgentRunBlock({
  events,
  finalEvent,
  onSelectToolEvent,
  onOpenStep,
  plan,
  planning,
  selectedToolEventId,
}: AgentRunBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const steps = useMemo(() => buildStepViews(plan, events), [events, plan]);
  const completedCount = steps.filter((step) => step.status === "completed").length;
  const runningStep = steps.find((step) => step.status === "running") ?? null;
  const activeStep = finalEvent
    ? null
    : (runningStep ?? steps.find((step) => step.status === "pending") ?? null);
  const failed = finalEvent?.type === "task_error";

  return (
    <div className="grid gap-4">
      <div className="flex gap-3">
        <AgentAvatar />
        <div className="max-w-5xl pt-1">
          <div className="text-base font-semibold text-blue-400">CurryAgent</div>
          <p className="mt-3 text-base leading-8 text-zinc-400">
            这是一个任务执行过程，已拆成 {plan.steps.length}
            个步骤。下面会按顺序规划、调用工具、记录证据并汇总结果。
          </p>
        </div>
      </div>
      <div className="ml-4 border-l border-dashed border-zinc-800/90 pl-7">
        <button
          className="flex w-full items-center justify-between gap-4 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.035]"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <StepBadge failed={failed} running={planning || Boolean(runningStep)} />
              <h3 className="truncate text-base font-semibold text-zinc-50">{plan.title}</h3>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{plan.goal}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              {completedCount} / {plan.steps.length}
            </span>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {expanded ? (
          <div className="grid gap-4 py-5">
            {steps.map((step, index) => (
              <StepCard
                highlighted={activeStep?.id === step.id}
                index={index}
                key={step.id}
                onOpenStep={onOpenStep}
                onSelectToolEvent={onSelectToolEvent}
                selectedToolEventId={selectedToolEventId}
                step={step}
              />
            ))}
          </div>
        ) : null}
      </div>

      {finalEvent ? <FinalAnswer event={finalEvent} steps={steps} /> : null}
    </div>
  );
}

function FinalAnswer({ event, steps }: { event: SessionEventItem; steps: PlanStepView[] }) {
  const failed = event.type === "task_error";
  const firstAnswer = steps
    .map((step) => parseToolOutput(step.toolEvent))
    .find((output) => output?.final_answer)?.final_answer;

  return (
    <div className="flex gap-4">
      <AgentAvatar />
      <div className="max-w-5xl pt-1">
        <div className="text-sm font-semibold text-blue-400">CurryAgent</div>
        <div className="mt-3 rounded-[26px] border border-white/10 bg-white/[0.035] px-5 py-4 text-lg leading-9 text-zinc-300">
          {failed ? (
            parseString(event.payload.message) || "任务执行失败，请查看事件详情。"
          ) : firstAnswer ? (
            <MarkdownContent content={firstAnswer} />
          ) : (
            "任务已完成。你可以点击步骤中的工具详情查看每次调用的输入和输出。"
          )}
        </div>
      </div>
    </div>
  );
}

function FormattedAnswer({ value }: { value: string }) {
  return (
    <div className="whitespace-pre-wrap">
      {value.split("\n").map((line, index) => (
        <p className="mb-2" key={`${line}-${index}`}>
          {line}
        </p>
      ))}
    </div>
  );
}

function StepBadge({ failed, running }: { failed: boolean; running: boolean }) {
  if (failed) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white">
        <AlertCircle size={18} aria-hidden="true" />
      </span>
    );
  }
  if (running) {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
        <Loader2 className="animate-spin" size={18} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
      <Check size={18} aria-hidden="true" />
    </span>
  );
}
