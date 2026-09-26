import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Hammer,
  Loader2,
  MessageSquare,
  UserRound,
} from "lucide-react";

import type { AgentTaskItem, ChatMessage, LoadState, SessionEventItem } from "@/types/sessions";
import type { AgentPlan } from "@/types/planner";
import { parseString } from "@/utils";
import { formatDate } from "@/lib/format";

export type ConversationTimelineProps = {
  events: LoadState<SessionEventItem[]>;
  messages: LoadState<ChatMessage[]>;
  onSelectToolEvent: (eventId: string) => void;
  plan: AgentPlan | null;
  selectedToolEventId: string | null;
  task: AgentTaskItem | null;
};

type TimelineItem =
  | { kind: "message"; id: string; created_at: string; message: ChatMessage }
  | { kind: "event"; id: string; created_at: string; event: SessionEventItem };

// 多agent的结果
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

function buildTimelineItems(messages: ChatMessage[], events: SessionEventItem[]): TimelineItem[] {
  // 过滤一些events 比如message_create
  const visibleEvents = events.filter((event) =>
    [
      "plan_created",
      "step_started",
      "tool_called",
      "step_completed",
      "task_done",
      "task_error",
    ].includes(event.type),
  );

  return [
    ...messages.map((message) => ({
      kind: "message" as const,
      id: `message-${message.id}`,
      created_at: message.created_at,
      message,
    })),
    ...visibleEvents.map((event) => ({
      kind: "event" as const,
      id: `event-${event.id}`,
      created_at: event.created_at,
      event,
    })),
  ].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function parsePlanPayload(payload: Record<string, unknown>): AgentPlan {
  const steps = Array.isArray(payload?.steps) ? payload?.steps : [];

  return {
    id: parseString(payload.id) || parseString(payload.plan_id),
    title: parseString(payload.title) || "任务执行计划",
    goal: parseString(payload?.goal),
    source: parseString(payload?.source) || "unknown",
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

function parseMultiAgentResult(value: string): MultiAgentInlineResult | null {
  try {
    const payload = JSON.parse(value) as Partial<MultiAgentInlineResult>;
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

function getEventMeta(type: string) {
  if (type === "step_started") {
    return {
      className: "border-sky-200 bg-sky-50 text-sky-700",
      icon: CircleDot,
      label: "开始执行步骤",
      tone: "running" as const,
    };
  }
  if (type === "step_completed") {
    return {
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
      label: "步骤完成",
      tone: "success" as const,
    };
  }
  if (type === "task_error") {
    return {
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: AlertCircle,
      label: "执行失败",
      tone: "error" as const,
    };
  }
  return {
    className: "border-slate-200 bg-white text-slate-700",
    icon: MessageSquare,
    label: type === "task_done" ? "任务完成" : type,
    tone: "assistant" as const,
  };
}

function getStepTitle(event: SessionEventItem, plan: AgentPlan | null): string {
  const title = parseString(event.payload?.title);
  if (title) {
    return title;
  }
  const stepId = parseString(event.payload?.step_id);
  return plan?.steps.find((step) => step.id === stepId)?.title ?? "";
}

export default function ConversationTimeline({
  events,
  messages,
  onSelectToolEvent,
  selectedToolEventId,
  plan,
  task,
}: ConversationTimelineProps) {
  if (messages.type === "loading" || events.type === "loading") {
    return <div className="p-5 text-sm text-slate-500">对话加载中...</div>;
  }

  if (messages.type === "error") {
    return <ErrorBlock message={messages.message} />;
  }

  if (events.type === "error") {
    return <ErrorBlock message={events.message} />;
  }

  const items = buildTimelineItems(messages.data, events.data);

  if (items.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center p-5 text-sm text-slate-500">
        暂无对话，发送第一条任务内容
      </div>
    );
  }

  return (
    <div className="grid gap-5 p-5">
      {items.map((item, index) => {
        if (item.kind === "message") {
          return <MessageBubble key={item.id} message={item.message} />;
        }

        return (
          <ExecutionEventCard
            event={item.event}
            key={item.id}
            onSelectToolEvent={onSelectToolEvent}
            plan={plan}
            selected={item.event.id === selectedToolEventId}
          />
        );
      })}
      <TaskStatusCard task={task} />
    </div>
  );
}

// 展示用户消息和 AI 消息
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const Icon = isUser ? UserRound : Bot;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {isUser ? null : <Avatar icon={Icon} tone="assistant" />}

      <div
        className={`max-w-[76%] rounded-md px-4 py-3 text-sm leading-6 ${
          isUser ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-800"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`mt-2 text-xs ${isUser ? "text-slate-300" : "text-slate-400"}`}>
          {formatDate(message.created_at)}
        </div>
      </div>
      {isUser ? <Avatar icon={Icon} tone="user" /> : null}
    </div>
  );
}

// 展示计划、步骤和工具调用事件
function ExecutionEventCard({
  event,
  onSelectToolEvent,
  plan,
  selected,
}: {
  event: SessionEventItem;
  onSelectToolEvent: (eventId: string) => void;
  plan: AgentPlan | null;
  selected: boolean;
}) {
  if (event.type === "plan_created") {
    return <PlanCreatedCard event={event} />;
  }

  if (event.type === "tool_called") {
    return (
      <ToolCalledCard event={event} onSelectToolEvent={onSelectToolEvent} selected={selected} />
    );
  }

  const title = getStepTitle(event, plan);
  const meta = getEventMeta(event.type);

  return (
    <div className="flex gap-3">
      <Avatar icon={meta.icon} tone={meta.tone} />
      <div className={`rounded-md border px-4 py-3 text-sm ${meta.className}`}>
        <div className="flex items-center gap-2 font-semibold">
          <meta.icon size={15} aria-hidden="true" />
          {meta.label}
        </div>
        {title ? <p className="mt-2 leading-6">{title}</p> : null}
        {event.type === "task_error" ? (
          <p className="mt-2 leading-6 text-rose-700">
            {parseString(event.payload.message) || "任务执行失败"}
          </p>
        ) : null}
        <div className="mt-2 text-xs opacity-70">{formatDate(event.created_at)}</div>
      </div>
    </div>
  );
}

function ToolCalledCard({
  event,
  onSelectToolEvent,
  selected,
}: {
  event: SessionEventItem;
  onSelectToolEvent: (eventId: string) => void;
  selected: boolean;
}) {
  const toolName = parseString(event.payload.tool_name) || "tool";
  const output = parseString(event.payload.output);
  const multiAgent = parseMultiAgentResult(output);

  return (
    <div className="flex gap-3">
      <Avatar icon={Hammer} tone="tool" />
      <button
        className={`w-full rounded-md border px-4 py-3 text-left text-sm transition ${
          selected
            ? "border-slate-950 bg-white shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
        onClick={() => onSelectToolEvent(event.id)}
        type="button"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-semibold text-slate-950">
            <Hammer size={15} aria-hidden="true" />
            <span className="truncate">{toolName}</span>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{formatDate(event.created_at)}</span>
        </div>

        {multiAgent ? (
          <MultiAgentInlineResult result={multiAgent} />
        ) : (
          <div className="mt-3 grid gap-2">
            <div className="text-xs font-medium text-slate-500">调用参数</div>
            <pre className="max-h-24 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">
              {JSON.stringify(event.payload.arguments ?? {}, null, 2)}
            </pre>
            <p className="line-clamp-3 text-xs leading-5 text-slate-600">
              {output || "工具已调用，暂无输出。"}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}

function MultiAgentInlineResult({ result }: { result: MultiAgentInlineResult }) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
        <GitBranch size={14} aria-hidden="true" />
        {result.manager} 已完成协作编排
      </div>
      <div className="mt-2 grid gap-2">
        {result.subtasks.map((subtask) => (
          <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5" key={subtask.id}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">{subtask.title}</span>
              <span className="text-slate-500">{subtask.status}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{subtask.assignee}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{subtask.output}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
        {result.review.reviewer} · {result.review.status}
      </div>
    </div>
  );
}
function PlanCreatedCard({ event }: { event: SessionEventItem }) {
  const plan = parsePlanPayload(event.payload);

  return (
    <div className="flex gap-3">
      <Avatar icon={GitBranch} tone="assistant" />
      <div className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
        <div className="flex items-center gap-2 font-semibold text-slate-950">
          <GitBranch size={15} aria-hidden="true" />
          AI 已生成执行计划
        </div>
        <p className="mt-2 leading-6 text-slate-600">{plan.goal}</p>
        <ol className="mt-3 grid gap-2">
          {plan.steps.map((step, index) => (
            <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={step.id}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500">
                  {index + 1}
                </span>
                {step.title}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 text-xs text-slate-400">{formatDate(event.created_at)}</div>
      </div>
    </div>
  );
}

function Avatar({
  icon: Icon,
  spin = false,
  tone,
}: {
  icon: typeof Bot;
  spin?: boolean;
  tone: "assistant" | "user" | "tool" | "running" | "success" | "error";
}) {
  const classes = {
    assistant: "bg-slate-100 text-slate-600",
    user: "bg-slate-950 text-white",
    tool: "bg-indigo-50 text-indigo-600",
    running: "bg-sky-50 text-sky-600",
    success: "bg-emerald-50 text-emerald-600",
    error: "bg-rose-50 text-rose-600",
  };

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${classes[tone]}`}
    >
      <Icon className={spin ? "animate-spin" : ""} size={16} aria-hidden="true" />
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="m-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </div>
  );
}

function TaskStatusCard({ task }: { task: AgentTaskItem | null }) {
  if (!task || ["succeeded", "failed", "cancelled"].includes(task.status)) {
    return null;
  }

  return (
    <div className="flex gap-3">
      <Avatar icon={Loader2} tone="running" spin />
      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
        后台任务正在执行：{task.status}
      </div>
    </div>
  );
}
