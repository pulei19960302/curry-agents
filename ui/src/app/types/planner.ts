import { PlanStepView } from "@/components/conversation/types";
import { SessionEventItem } from "./sessions";

export type PlanStep = {
  id: string;
  title: string;
  description: string;
  expected_output: string;
  status: string;
};

export type AgentPlan = {
  id: string;
  title: string;
  goal: string;
  source: string;
  steps: PlanStep[];
};

export type PlanCreateData = {
  plan: AgentPlan;
  event: SessionEventItem;
};

export type PlanExecuteData = {
  events: SessionEventItem[];
};

export type PlanProgressView = {
  activeStep: PlanStepView | null; // 当前正在执行或即将执行的步骤
  completedCount: number; // 已完成步骤数量
  expandedByDefault: boolean;  // 任务运行时是否默认展开计划条
  failed: boolean; // 任务是否已经失败。
  running: boolean; // 任务是否正在规划或执行
  steps: PlanStepView[]; // 完整步骤列表，用于展开后展示
  title: string; // 标题
  totalCount: number; // 总步骤数量
};
