import type { ChatMessage, SessionEventItem } from "@/types/sessions";
import type { AgentPlan } from "@/types/planner";
import type {
  AgentRunViewModel,
  TimelineItem,
  PlanStepView,
  MultiAgentInlineResult,
} from "@/components/conversation/types";
import { parseString } from "@/utils";

// 把后端事件整理成前端时间线模型
export function buildAgentRunViewModel(
  message: ChatMessage[],
  events: SessionEventItem[],
  plan: AgentPlan | null,
): AgentRunViewModel {
  const timelineItems = buildTimelineItems(message, events);

  const latestPlan = plan && getLatestPlanFromEvents(events);

  // 找到最后一个task_done或task_error事件
  const finalEvent =
    [...events].reverse().find((event) => ["task_done", "task_error"].includes(event.type)) ?? null;

  return {
    finalEvent,
    latestPlan,
    timelineItems,
  };
}

function buildTimelineItems(messages: ChatMessage[], events: SessionEventItem[]): TimelineItem[] {
  // 找到plan_created事件
  const planEvents = events?.filter((event) => event.type === "plan_created");

  return [
    ...messages.map((message) => ({
      kind: "message" as const,
      id: `message-${message.id}`,
      created_at: message.created_at,
      message: message,
    })),

    ...planEvents.map((event) => ({
      kind: "plan" as const,
      id: `event-${event.id}`,
      created_at: event.created_at,
      event: event,
    })),
  ].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

// 把计划事件转换成可展示的步骤状态
export function buildStepViews(plan: AgentPlan, events: SessionEventItem[]): PlanStepView[] {
  return plan.steps.map((step) => {
    //找到与当前步骤相关的事件
    const related = events.filter((event) => parseString(event.payload.step_id) === step.id);

    // 找到开始、完成、工具调用和失败事件
    const started = related.find((event) => event.type === "step_started") ?? null;
    const completed = related.find((event) => event.type === "step_completed") ?? null;
    // 执行的步骤
    const toolEvent = related.find((event) => event.type === "tool_called") ?? null;

    const failed = related.find((event) => event.type === "task_error");

    const status = failed ? "failed" : completed ? "completed" : started ? "running" : step.status;

    return {
      ...step,
      startedAt: started?.created_at ?? null,
      completedAt: completed?.created_at ?? null,
      status,
      summary: parseString(completed?.payload.summary),
      toolEvent,
    };
  });
}

// 找到events事件中最新的plan_created
function getLatestPlanFromEvents(events: SessionEventItem[]): AgentPlan | null {
  const event = [...events].reverse().find((item) => item.type === "plan_created");
  if (!event) {
    return null;
  }

  return parsePlanPayload(event.payload);
}

function parsePlanPayload(payload: Record<string, unknown>): AgentPlan {
  // 获取步骤
  const steps = Array.isArray(payload.steps) ? payload.steps : [];

  return {
    id: parseString(payload.id) || parseString(payload.plan_id),
    title: parseString(payload.title) || "任务执行计划",
    goal: parseString(payload.goal),
    source: parseString(payload.source) || "unknown",
    steps: steps.map((step, index) => {
      const value = step as Record<string, unknown>;

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

// 解析工具输出，供步骤卡片和最终回答复用
export function parseToolOutput(event: SessionEventItem | null): MultiAgentInlineResult | null {
  // 获取工具输出
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

// 多任务输出
export function buildToolPills(
  step: PlanStepView,
  output: MultiAgentInlineResult | null,
): string[] {
  if (output?.subtasks.length) {
    return output.subtasks.slice(0, 3).map((subtask) => subtask.title);
  }
  return [`正在处理 ${step.title}`, step.expected_output || step.description || "整理任务结果"];
}

export function getRunningCopy(step: PlanStepView): string {
  const toolName = parseString(step.toolEvent?.payload?.tool_name);
  if (toolName) {
    return `正在调用 ${toolName}，处理“${step.title}”。`;
  }
  return `正在执行“${step.title}”。`;
}

// 运行时候的 class
export function getStatusClass(status: string) {
  if (status === "completed") {
    return "shrink-0 whitespace-nowrap rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300";
  }
  if (status === "running") {
    return "shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200";
  }
  if (status === "waiting") {
    return "shrink-0 whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200";
  }
  if (status === "retrying") {
    return "shrink-0 whitespace-nowrap rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200";
  }
  if (status === "failed") {
    return "shrink-0 whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200";
  }
  if (status === "stopped") {
    return "shrink-0 whitespace-nowrap rounded-full border border-zinc-500/30 bg-zinc-500/10 px-3 py-1 text-xs font-semibold text-zinc-300";
  }
  return "shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-500";
}

export function getStatusLabel(status: string) {
  if (status === "completed") {
    return "完成";
  }
  if (status === "running") {
    return "运行中";
  }
  if (status === "waiting") {
    return "等待中";
  }
  if (status === "retrying") {
    return "重试中";
  }
  if (status === "failed") {
    return "失败";
  }
  if (status === "stopped") {
    return "停止";
  }
  return "待处理";
}
