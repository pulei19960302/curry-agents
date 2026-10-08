import type { ChatMessage, SessionEventItem } from "@/types/sessions";
import type { AgentPlan, PlanProgressView } from "@/types/planner";
import type {
  AgentRunViewModel,
  TimelineItem,
  PlanStepView,
  MultiAgentInlineResult,
  ToolObservation,
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

// 从事件生成计划进度模型
export function buildPlanProgressView(
  plan: AgentPlan | null,
  events: SessionEventItem[],
  planning: boolean,
  executing: boolean,
): PlanProgressView | null {
  if (!plan) {
    return null;
  }
  const steps = buildStepViews(plan, events);

  const completedCount = steps.filter((step) => step.status === "completed").length;
  const failed = Boolean(events.find((event) => event.type === "task_error")?.id); // 找到一个task_error事件就算失败

  const runningStep = steps.find((step) => step.status === "running") ?? null;
  const pendingStep = steps.find((step) => step.status === "pending") ?? null;
  const activeStep = failed ? null : (runningStep ?? pendingStep);
  const running = planning || executing || Boolean(runningStep);

  return {
    activeStep,
    completedCount,
    expandedByDefault: running,
    failed,
    running,
    steps,
    title: plan.title || "任务执行计划",
    totalCount: steps.length,
  };
}

// 多任务输出
export function buildToolPills(
  step: PlanStepView,
  output: MultiAgentInlineResult | null,
): string[] {
  const observation = buildToolObservation(step);
  if (observation.pills.length) {
    return observation.pills;
  }
  if (output?.subtasks.length) {
    return output.subtasks.slice(0, 3).map((subtask) => subtask.title);
  }
  return [`正在处理 ${step.title}`, step.expected_output || step.description || "整理任务结果"];
}

export function buildToolObservation(step: PlanStepView): ToolObservation {
  const toolEvent = step.toolEvent;
  const toolName = parseString(toolEvent?.payload.tool_name);
  const output = parseString(toolEvent?.payload.output);

  if (toolEvent?.id) {
    return {
      title: "等待工具调用",
      brief: step.description || step.expected_output || "这个步骤还没有开始调用工具。",
      pills: [],
    };
  }
  const parsed = parseJsonObject(output);
  if (parsed?.kind === "search_results") {
    const query = parseString(parsed.query);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const titles = items
      .map((item) => parseString((item as Record<string, unknown>).title))
      .filter(Boolean)
      .slice(0, 3);
    return {
      title: "搜索完成",
      brief: `已搜索“${query || step.title}”，找到 ${items.length} 条候选结果。`,
      pills: titles.length ? titles : ["查看搜索结果"],
    };
  }

  if (parsed?.kind === "browser_screenshot") {
    const size = Number(parsed.size || 0);
    const sizeKb = size > 0 ? `${Math.round(size / 1024)} KB` : "未知大小";
    return {
      title: "浏览器截图完成",
      brief: `已截取当前浏览器页面截图，图片大小约 ${sizeKb}。`,
      pills: ["查看截图", "打开远程桌面"],
    };
  }

  if (parsed?.kind === "mcp_tool_result") {
    const serverName = parseString(parsed.server_name);
    const mcpToolName = parseString(parsed.tool_name);
    return {
      title: "MCP 工具返回结果",
      brief: `已调用 ${serverName || "MCP Server"} 的 ${mcpToolName || "工具"}。`,
      pills: ["查看 MCP 输出"],
    };
  }

  if (parsed?.kind === "a2a_task_result") {
    const remoteAgent = parseString(parsed.remote_agent);
    const status = parseString(parsed.status);
    return {
      title: "远程 Agent 返回结果",
      brief: `${remoteAgent || "远程 Agent"} 已返回任务状态：${status || "unknown"}。`,
      pills: ["查看协作步骤", "查看远程输出"],
    };
  }

  if (parsed?.kind === "multi_agent_result") {
    const result = parseToolOutput(toolEvent);
    const subtasks = result?.subtasks.slice(0, 3).map((item) => item.title) ?? [];
    return {
      title: "多 Agent 协作完成",
      brief: result?.final_answer
        ? trimText(result.final_answer, 110)
        : `已完成 ${result?.subtasks.length ?? 0} 个子任务协作。`,
      pills: subtasks.length ? subtasks : ["查看协作结果"],
    };
  }

  if (toolName.startsWith("shell_")) {
    const returnCode = matchLineValue(output, "退出码");
    const command = matchLineValue(output, "命令");
    return {
      title: "Shell 命令执行完成",
      brief: `命令${command ? `“${command}”` : ""}已返回，退出码 ${returnCode || "未知"}。`,
      pills: ["查看终端输出"],
    };
  }

  if (toolName.startsWith("browser_")) {
    const pageTitle = matchLineValue(output, "页面标题");
    const currentUrl = matchLineValue(output, "页面已打开") || matchLineValue(output, "当前地址");
    return {
      title: "浏览器操作完成",
      brief: pageTitle
        ? `页面标题：${pageTitle}`
        : currentUrl
          ? `浏览器已打开：${currentUrl}`
          : "浏览器工具已返回结果。",
      pills: ["查看浏览器详情"],
    };
  }

  if (toolName.startsWith("file_")) {
    return {
      title: "文件工具完成",
      brief: firstUsefulLine(output) || "文件工具已返回结果。",
      pills: ["查看文件输出"],
    };
  }

  if (parsed) {
    return {
      title: "结构化工具结果",
      brief: "工具已返回结构化数据，点击右侧详情查看整理后的内容。",
      pills: ["查看工具详情"],
    };
  }

  return {
    title: getToolDisplayName(toolName),
    brief: firstUsefulLine(output) || "工具已返回结果。",
    pills: ["查看工具详情"],
  };
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

export function getStepDisplaySummary(step: PlanStepView) {
  if (step.status === "running") {
    return getRunningCopy(step);
  }
  if (step.status === "completed") {
    return buildToolObservation(step).brief || step.expected_output || "步骤已完成。";
  }
  if (step.status === "failed") {
    return "步骤执行失败，请查看任务错误或工具详情。";
  }
  return step.description || step.expected_output || "等待执行。";
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  if (!value.trim().startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function matchLineValue(value: string, label: string) {
  const line = value.split("\n").find((item) => item.trim().startsWith(`${label}：`));
  return line ? line.split("：").slice(1).join("：").trim() : "";
}

function firstUsefulLine(value: string) {
  return trimText(
    value
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.includes('"kind"')) || "",
    120,
  );
}

function trimText(value: string, maxLength: number) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  if (cleanValue.length <= maxLength) {
    return cleanValue;
  }
  return `${cleanValue.slice(0, maxLength)}...`;
}

function getToolDisplayName(toolName: string) {
  if (toolName === "search_web") {
    return "搜索工具";
  }
  if (toolName === "browser_open") {
    return "浏览器打开网页";
  }
  if (toolName === "browser_screenshot") {
    return "浏览器截图";
  }
  if (toolName.startsWith("browser_")) {
    return "浏览器工具";
  }
  if (toolName.startsWith("shell_")) {
    return "Shell 工具";
  }
  if (toolName.startsWith("file_")) {
    return "文件工具";
  }
  if (toolName.startsWith("mcp_")) {
    return "MCP 工具";
  }
  if (toolName.startsWith("a2a_")) {
    return "远程 Agent 工具";
  }
  if (toolName.startsWith("multi_agent_")) {
    return "多 Agent 协作";
  }
  return toolName || "工具";
}
