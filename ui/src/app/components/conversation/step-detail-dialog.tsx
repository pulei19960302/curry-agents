import { X } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";

import type { PlanStepView } from "./types";
import { buildToolObservation, getStatusLabel } from "./view-model";
import { parseString } from "@/utils";
import { formatDateTime } from "@/lib/format";

type StepDetailDialogProps = {
  onClose: () => void;
  onSelectToolEvent: (eventId: string) => void;
  step: PlanStepView;
};

export default function StepDetailDialog({
  onClose,
  onSelectToolEvent,
  step,
}: StepDetailDialogProps) {
  const toolName = parseString(step.toolEvent?.payload.tool_name);
  const observation = buildToolObservation(step);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <section
        aria-labelledby="step-detail-title"
        aria-modal="true"
        className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#090b12] shadow-2xl shadow-black/70"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-medium tracking-[0.18em] text-blue-400 uppercase">
              Step Detail
            </div>
            <h3 id="step-detail-title" className="mt-2 text-xl font-semibold text-zinc-50">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {step.description ||
                step.expected_output ||
                "查看这个步骤的执行目标、状态和工具输出。"}
            </p>
          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-zinc-50"
            onClick={onClose}
            title="关闭步骤详情"
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(86vh-116px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <DetailStat label="状态" value={getStatusLabel(step.status)} />
            <DetailStat label="开始时间" value={formatDateTime(step.startedAt) ?? "尚未开始"} />
            <DetailStat label="完成时间" value={formatDateTime(step.completedAt) ?? "尚未完成"} />
          </div>

          <div className="mt-5 grid gap-4">
            <DetailBlock title="预期输出">
              {step.expected_output || "这个步骤会在执行完成后沉淀可验证结果。"}
            </DetailBlock>
            <DetailBlock title="执行摘要">{step.summary || "执行中或尚未生成摘要。"}</DetailBlock>
            <DetailBlock title="工具调用">
              {step.toolEvent ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 font-semibold text-blue-200">
                      {toolName || "tool_called"}
                    </span>
                    <button
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-300 hover:border-blue-500/40 hover:text-zinc-50"
                      onClick={() => {
                        onSelectToolEvent(step.toolEvent!.id);
                        onClose();
                      }}
                      type="button"
                    >
                      打开右侧工具详情
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-sm font-semibold text-zinc-100">{observation.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{observation.brief}</p>
                    {observation.pills.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {observation.pills.map((label) => (
                          <span
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-400"
                            key={label}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                "这个步骤暂时没有工具调用。"
              )}
            </DetailBlock>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div className="text-xs text-zinc-600">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function DetailBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
      <div className="mt-3 line-clamp-3 text-sm leading-6 break-all text-zinc-400">{children}</div>
    </section>
  );
}
