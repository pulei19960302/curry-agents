import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";

import type { AgentTaskItem, ChatMessage, LoadState, SessionEventItem } from "@/types/sessions";
import type { AgentPlan, PlanStepView } from "@/types/planner";
import { parseString } from "@/utils";

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
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">
            分配一个任务，开始让 Agent 工作
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            发送后会在这里展示任务理解、计划拆解、工具调用和最终结果。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto grid max-w-6xl gap-8">
        {items.map((item) =>
          item.kind === "message" ? (
            <MessageBubble key={item.id} message={item.message} />
          ) : latestPlan ? (
            <AgentRunBlock
              events={events.data}
              finalEvent={finalEvent ?? null}
              key={item.id}
              onSelectToolEvent={onSelectToolEvent}
              plan={latestPlan}
              planning={planning}
              selectedToolEventId={selectedToolEventId}
            />
          ) : null,
        )}
        <TaskStatusCard task={task} />
        {planning || executing ? (
          <RunningBlock text={planning ? "正在生成执行计划..." : "正在执行计划..."} />
        ) : null}
      </div>
    </div>
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
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl border border-white/10 bg-[#171a25] px-5 py-4 text-lg leading-8 font-semibold text-zinc-50 shadow-2xl shadow-black/30">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <AgentAvatar />
      <div className="max-w-4xl pt-1">
        <div className="text-sm font-semibold text-blue-400">CurryAgent</div>
        <p className="mt-3 text-lg leading-9 whitespace-pre-wrap text-zinc-400">
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
  plan,
  planning,
  selectedToolEventId,
}: {
  events: SessionEventItem[];
  finalEvent: SessionEventItem | null;
  onSelectToolEvent: (eventId: string) => void;
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
    <div className="grid gap-5">
      <div className="flex gap-4">
        <AgentAvatar />
        <div className="max-w-5xl pt-1">
          <div className="text-sm font-semibold text-blue-400">CurryAgent</div>
          <p className="mt-3 text-lg leading-9 text-zinc-400">
            我会把这个任务拆成 {plan.steps.length} 个步骤，按顺序执行，并在需要时调用工具。
          </p>
        </div>
      </div>

      <div className="ml-5 border-l border-dashed border-zinc-800 pl-8">
        <button
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#131522]/90 px-5 py-4 text-left shadow-2xl shadow-black/25"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <StepBadge failed={failed} running={planning || Boolean(runningStep)} />
              <h3 className="truncate text-lg font-semibold text-zinc-50">{plan.title}</h3>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{plan.goal}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-400">
            <span>
              {completedCount} / {plan.steps.length}
            </span>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {expanded ? (
          <div className="grid gap-5 py-6">
            {steps.map((step, index) => (
              <StepCard
                index={index}
                key={step.id}
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
  onSelectToolEvent,
  selectedToolEventId,
  step,
}: {
  index: number;
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
      <div className="absolute -left-[43px] flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800 bg-[#08090d]">
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

      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="line-clamp-2 text-xl leading-8 font-semibold text-zinc-50">
                {step.title}
              </h4>
            </div>
            <p className="mt-3 text-lg leading-8 text-zinc-300">
              {running
                ? getRunningCopy(step)
                : completed
                  ? step.summary || step.expected_output || "步骤已完成。"
                  : step.description}
            </p>
          </div>
          <span className={getStatusClass(step.status)}>{getStatusLabel(step.status)}</span>
        </div>

        {running || completed ? (
          <div className="grid max-w-3xl gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-lg font-semibold text-zinc-400">
              <Wrench className="text-blue-400" size={22} aria-hidden="true" />
              {running ? "正在使用工具" : "工具调用完成"}
            </div>
            <div className="grid gap-3">
              {searchPills.map((label) => (
                <button
                  className="flex w-fit max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left text-lg font-semibold text-zinc-500 transition hover:border-blue-500/40 hover:text-zinc-200"
                  disabled={!step.toolEvent}
                  key={label}
                  onClick={() => step.toolEvent && onSelectToolEvent(step.toolEvent.id)}
                  type="button"
                >
                  <Search className="shrink-0 text-blue-400" size={24} aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step.toolEvent ? (
          <button
            className={`w-fit rounded-xl border px-4 py-2 text-sm font-medium transition ${
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

function TaskStatusCard({ task }: { task: AgentTaskItem | null }) {
  if (!task || ["succeeded", "failed", "cancelled"].includes(task.status)) {
    return null;
  }

  return <RunningBlock text={`后台任务正在执行：${task.status}`} />;
}

function RunningBlock({ text }: { text: string }) {
  return (
    <div className="flex gap-4">
      <AgentAvatar loading />
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-lg font-semibold text-blue-200">
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
        <div className="mt-3 text-lg leading-9 text-zinc-400">
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
    return "rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300";
  }
  if (status === "running") {
    return "rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200";
  }
  if (status === "failed") {
    return "rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200";
  }
  return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-500";
}

function getStatusLabel(status: string) {
  if (status === "completed") {
    return "done";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "failed") {
    return "failed";
  }
  return "pending";
}
