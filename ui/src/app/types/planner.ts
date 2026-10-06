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
