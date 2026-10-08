import type { ChatMessage, SessionEventItem } from "@/types/sessions";
import type { AgentPlan, PlanStep } from "@/types/planner";

// 页面时间线的统一条目。它把消息和计划事件放进同一个列表，方便按时间排序展示。
export type TimelineItem =
  | {
      kind: "message";
      id: string;
      created_at: string;
      message: ChatMessage;
    }
  | {
      kind: "plan";
      id: string;
      created_at: string;
      event: SessionEventItem;
    };

// 前端真正展示的步骤结构。它不是后端原始 PlanStep，而是在 PlanStep 基础上补充了开始时间、完成时间、工具事件和摘要。
export type PlanStepView = PlanStep & {
  startedAt: string | null;
  completedAt: string | null;
  toolEvent: SessionEventItem | null;
  summary: string;
};

// 多 Agent 工具输出的前端解析结果。步骤卡片和最终回答都会读取它
export type MultiAgentInlineResult = {
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

// ConversationTimeline 最终需要的数据结构。入口组件拿到它之后，只需要负责渲染。
export type AgentRunViewModel = {
  finalEvent: SessionEventItem | null;
  latestPlan: AgentPlan | null;
  timelineItems: TimelineItem[];
};

export type ToolObservation = {
  title: string; // 工具动作的短标题，例如“搜索完成”“浏览器截图完成”
  brief: string; // 给主步骤卡片显示的一句话摘要
  pills: string[]; // 步骤下方的轻量节点，例如搜索结果标题、查看截图、查看终端输出
};
