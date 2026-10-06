import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Maximize2,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AgentTaskItem, ChatMessage, LoadState, SessionEventItem } from "@/types/sessions";
import type { AgentPlan, PlanStepView } from "@/types/planner";
import { parseString } from "@/utils";
import { formatDateTime } from "@/lib/format";

type ConversationTimelineProps = {
  events: LoadState<SessionEventItem[]>;
  messages: LoadState<ChatMessage[]>;
  onSelectToolEvent: (eventId: string) => void;
  plan: AgentPlan | null;
  planning: boolean;
  executing: boolean;
  selectedToolEventId: string | null;
  task: AgentTaskItem | null;
};

type TimelineItem =
  | { kind: "message"; id: string; created_at: string; message: ChatMessage }
  | { kind: "plan"; id: string; created_at: string; event: SessionEventItem };

type MultiAgentInlineResult = {
  kind: "multi_agent_result";
  manager: string;
  subtasks: Array<{
    id: string;
    assignee: string;
    title: string;
    status: string;
    output: string;
  }>;
  review: {
    reviewer: string;
    status: string;
  };
  final_answer: string;
};

export default function ConversationTimeline({
  events,
  messages,
  onSelectToolEvent,
  plan,
  planning,
  executing,
  selectedToolEventId,
  task,
}: ConversationTimelineProps) {
  const [detailStep, setDetailStep] = useState<PlanStepView | null>(null);

  if (messages.type === "loading" || events.type === "loading") {
    return <div className="flex-1 px-8 py-8 text-sm text-zinc-500">对话加载中...</div>;
  }

  if (messages.type === "error") {
    return <ErrorBlock message={messages.message} />;
  }

  if (events.type === "error") {
    return <ErrorBlock message={events.message} />;
  }

  const items = buildTimelineItems(messages.data, events.data);
  const latestPlan = plan ?? getLatestPlanFromEvents(events.data);
  const finalEvent = [...events.data]
    .reverse()
    .find((event) => event.type === "task_done" || event.type === "task_error");

  if (items.length === 0) {
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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-8 py-8 max-md:px-4">
        <div className="mx-auto grid max-w-3xl gap-7">
          {items.map((item) =>
            item.kind === "message" ? (
              <MessageBubble key={item.id} message={item.message} />
            ) : latestPlan ? (
              <AgentRunBlock
                events={events.data}
                finalEvent={finalEvent ?? null}
                key={item.id}
                onSelectToolEvent={onSelectToolEvent}
                onOpenStep={setDetailStep}
                plan={latestPlan}
                planning={planning}
                selectedToolEventId={selectedToolEventId}
              />
            ) : null,
          )}
          <TaskStatusCard task={task} />
          {planning || executing ? (
            <RunningBlock
              text={planning ? "正在理解任务并生成计划..." : "正在执行计划并同步工具结果..."}
            />
          ) : null}
        </div>
      </div>
      {detailStep ? (
        <StepDetailDialog
          onClose={() => setDetailStep(null)}
          onSelectToolEvent={onSelectToolEvent}
          step={detailStep}
        />
      ) : null}
    </>
  );
}

function buildTimelineItems(messages: ChatMessage[], events: SessionEventItem[]): TimelineItem[] {
  const planEvents = events.filter((event) => event.type === "plan_created");

  return [
    ...messages.map((message) => ({
      kind: "message" as const,
      id: `message-${message.id}`,
      created_at: message.created_at,
      message,
    })),
    ...planEvents.map((event) => ({
      kind: "plan" as const,
      id: `plan-${event.id}`,
      created_at: event.created_at,
      event,
    })),
  ].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end pt-2">
        <div className="max-w-[82%] rounded-2xl border border-white/10 bg-[#151722]/90 px-5 py-3 text-base leading-7 font-semibold text-zinc-50 shadow-xl shadow-black/25 max-md:max-w-full">
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

function AgentRunBlock({
  events,
  finalEvent,
  onSelectToolEvent,
  onOpenStep,
  plan,
  planning,
  selectedToolEventId,
}: {
  events: SessionEventItem[];
  finalEvent: SessionEventItem | null;
  onSelectToolEvent: (eventId: string) => void;
  onOpenStep: (step: PlanStepView) => void;
  plan: AgentPlan;
  planning: boolean;
  selectedToolEventId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const steps = useMemo(() => buildPlanStepViews(plan, events), [events, plan]);
  const completedCount = steps.filter((step) => step.status === "completed").length;
  const runningStep = steps.find((step) => step.status === "running") ?? null;
  const failed = finalEvent?.type === "task_error";

  return (
    <div className="grid gap-4">
      <div className="flex gap-4">
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
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111421]/90 px-4 py-3 text-left shadow-xl shadow-black/20 transition hover:border-blue-500/30"
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

function StepCard({
  index,
  onOpenStep,
  onSelectToolEvent,
  selectedToolEventId,
  step,
}: {
  index: number;
  onOpenStep: (step: PlanStepView) => void;
  onSelectToolEvent: (eventId: string) => void;
  selectedToolEventId: string | null;
  step: PlanStepView;
}) {
  const running = step.status === "running";
  const completed = step.status === "completed";
  const failed = step.status === "failed";
  const output = parseToolOutput(step.toolEvent);
  const searchPills = buildSearchPills(step, output);

  return (
    <div className="relative">
      <div className="absolute top-2 -left-[43px] flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-[#08090d] shadow-lg shadow-black/30">
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
              {searchPills.map((label) => (
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

function StepDetailDialog({
  onClose,
  onSelectToolEvent,
  step,
}: {
  onClose: () => void;
  onSelectToolEvent: (eventId: string) => void;
  step: PlanStepView;
}) {
  const toolName = parseString(step.toolEvent?.payload.tool_name);
  const toolOutput = parseString(step.toolEvent?.payload.output);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <section className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#090b12] shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-medium tracking-[0.18em] text-blue-400 uppercase">
              Step Detail
            </div>
            <h3 className="mt-2 text-xl font-semibold text-zinc-50">{step.title}</h3>
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
                  <pre className="max-h-56 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-5 whitespace-pre-wrap text-zinc-400">
                    {toolOutput || "<no output>"}
                  </pre>
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

function DetailBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
      <div className="mt-3 line-clamp-2 text-sm leading-6 break-all text-zinc-400">{children}</div>
    </section>
  );
}

function TaskStatusCard({ task }: { task: AgentTaskItem | null }) {
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

function RunningBlock({ text }: { text: string }) {
  return (
    <div className="flex gap-4">
      <AgentAvatar loading />
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-base font-semibold text-blue-200 shadow-2xl shadow-blue-950/20">
        {text}
      </div>
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
            <FormattedAnswer value={firstAnswer} />
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

function AgentAvatar({ loading = false }: { loading?: boolean }) {
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

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="m-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
      {message}
    </div>
  );
}

function buildPlanStepViews(plan: AgentPlan, events: SessionEventItem[]): PlanStepView[] {
  return plan.steps.map((step) => {
    const related = events.filter((event) => parseString(event.payload.step_id) === step.id);
    const started = related.find((event) => event.type === "step_started") ?? null;
    const completed = related.find((event) => event.type === "step_completed") ?? null;
    const toolEvent = related.find((event) => event.type === "tool_called") ?? null;
    const failed = related.find((event) => event.type === "task_error");
    const status = failed ? "failed" : completed ? "completed" : started ? "running" : step.status;

    return {
      ...step,
      completedAt: completed?.created_at ?? null,
      startedAt: started?.created_at ?? null,
      status,
      summary: parseString(completed?.payload.summary),
      toolEvent,
    };
  });
}

function getLatestPlanFromEvents(events: SessionEventItem[]): AgentPlan | null {
  const event = [...events].reverse().find((item) => item.type === "plan_created");
  if (!event) {
    return null;
  }
  return parsePlanPayload(event.payload);
}

function parsePlanPayload(payload: Record<string, unknown>): AgentPlan {
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  return {
    id: parseString(payload.id) || parseString(payload.plan_id),
    title: parseString(payload.title) || "任务执行计划",
    goal: parseString(payload.goal),
    source: parseString(payload.source) || "unknown",
    steps: steps.map((item, index) => {
      const value = item as Record<string, unknown>;
      return {
        id: parseString(value.id) || `step-${index + 1}`,
        title: parseString(value.title) || `步骤 ${index + 1}`,
        description: parseString(value.description),
        expected_output: parseString(value.expected_output),
        status: parseString(value.status) || "pending",
      };
    }),
  };
}

function parseToolOutput(event: SessionEventItem | null): MultiAgentInlineResult | null {
  const output = parseString(event?.payload.output);
  if (!output) {
    return null;
  }
  try {
    const payload = JSON.parse(output) as Partial<MultiAgentInlineResult>;
    if (
      payload.kind === "multi_agent_result" &&
      typeof payload.manager === "string" &&
      Array.isArray(payload.subtasks) &&
      payload.review &&
      typeof payload.review === "object"
    ) {
      const review = payload.review as Partial<MultiAgentInlineResult["review"]>;
      return {
        kind: "multi_agent_result",
        manager: payload.manager,
        subtasks: payload.subtasks.map((item) => ({
          id: parseString(item.id),
          assignee: parseString(item.assignee),
          title: parseString(item.title),
          status: parseString(item.status),
          output: parseString(item.output),
        })),
        review: {
          reviewer: parseString(review.reviewer),
          status: parseString(review.status),
        },
        final_answer: parseString(payload.final_answer),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function buildSearchPills(step: PlanStepView, output: MultiAgentInlineResult | null): string[] {
  if (output?.subtasks.length) {
    return output.subtasks.slice(0, 3).map((subtask) => subtask.title);
  }
  return [`正在处理 ${step.title}`, step.expected_output || step.description || "整理任务结果"];
}

function getRunningCopy(step: PlanStepView) {
  const toolName = parseString(step.toolEvent?.payload.tool_name);
  if (toolName) {
    return `正在调用 ${toolName}，处理“${step.title}”。`;
  }
  return `正在执行“${step.title}”。`;
}

function getStatusClass(status: string) {
  if (status === "completed") {
    return "shrink-0 whitespace-nowrap rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300";
  }
  if (status === "running") {
    return "shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200";
  }
  if (status === "failed") {
    return "shrink-0 whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200";
  }
  return "shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-500";
}

function getStatusLabel(status: string) {
  if (status === "completed") {
    return "完成";
  }
  if (status === "running") {
    return "运行";
  }
  if (status === "failed") {
    return "失败";
  }
  return "等待";
}
