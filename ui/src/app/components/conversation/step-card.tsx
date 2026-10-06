import { AlertCircle, Check, Circle, Loader2, Maximize2, Search, Wrench } from "lucide-react";

import type { PlanStepView } from "./types";
import {
  buildToolPills,
  getRunningCopy,
  getStatusClass,
  getStatusLabel,
  parseToolOutput,
} from "./view-model";

type StepCardProps = {
  index: number;
  onOpenStep: (step: PlanStepView) => void;
  onSelectToolEvent: (eventId: string) => void;
  selectedToolEventId: string | null;
  step: PlanStepView;
};

export default function StepCard({
  index,
  onOpenStep,
  onSelectToolEvent,
  selectedToolEventId,
  step,
}: StepCardProps) {
  const running = step.status === "running";
  const completed = step.status === "completed";
  const failed = step.status === "failed";
  const output = parseToolOutput(step.toolEvent);
  const toolPills = buildToolPills(step, output);

  return (
    <div className="relative">
      <div className="absolute top-2 -left-[44px] flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-[#08090d] shadow-lg shadow-black/30">
        {completed ? (
          <Check className="text-blue-400" size={17} aria-hidden="true" />
        ) : running ? (
          <Loader2 className="animate-spin text-blue-400" size={17} aria-hidden="true" />
        ) : failed ? (
          <AlertCircle className="text-rose-400" size={17} aria-hidden="true" />
        ) : (
          <Circle className="text-zinc-600" size={12} aria-hidden="true" />
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-transparent bg-transparent p-1 transition hover:bg-white/[0.035]">
        <button
          className="flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          onClick={() => onOpenStep(step)}
          type="button"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="truncate text-base leading-7 font-semibold text-zinc-50">
                {step.title}
              </h4>
              <Maximize2 className="shrink-0 text-zinc-600" size={14} aria-hidden="true" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 break-all text-zinc-400">
              {running
                ? getRunningCopy(step)
                : completed
                  ? step.summary || step.expected_output || "步骤已完成。"
                  : step.description}
            </p>
          </div>
          <span className={getStatusClass(step.status)}>{getStatusLabel(step.status)}</span>
        </button>

        {running || completed ? (
          <div className="ml-3 grid max-w-3xl gap-3 border-l border-dashed border-zinc-800/90 pl-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-sm font-semibold text-blue-200">
              <Wrench className="text-blue-400" size={18} aria-hidden="true" />
              {running ? "正在使用工具" : "工具调用完成"}
            </div>
            <div className="grid gap-3">
              {toolPills.map((label) => (
                <button
                  className="flex w-fit max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-left text-base font-semibold text-zinc-400 transition hover:border-blue-500/40 hover:text-zinc-100"
                  disabled={!step.toolEvent}
                  key={label}
                  onClick={() => step.toolEvent && onSelectToolEvent(step.toolEvent.id)}
                  type="button"
                >
                  <Search className="shrink-0 text-blue-400" size={20} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step.toolEvent ? (
          <button
            className={`ml-3 w-fit rounded-full border px-4 py-2 text-sm font-medium transition ${
              selectedToolEventId === step.toolEvent.id
                ? "border-blue-400 bg-blue-500/15 text-blue-200"
                : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-blue-500/40 hover:text-zinc-100"
            }`}
            onClick={() => onSelectToolEvent(step.toolEvent!.id)}
            type="button"
          >
            查看工具详情
          </button>
        ) : null}
      </div>
    </div>
  );
}
