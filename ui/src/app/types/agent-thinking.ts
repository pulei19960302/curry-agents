export type ThinkingModeInfo = {
  mode: string;
  name: string;
  summary: string;
  best_for: string;
  risk: string;
};

export type ThinkingModeListData = {
  items: ThinkingModeInfo[];
};

export type ThinkingModeDemo = {
  mode: string;
  name: string;
  headline: string;
  steps: string[];
  tool_calls: string[];
  final_answer: string;
};

export type ThinkingComparisonData = {
  task: string;
  demos: ThinkingModeDemo[];
};
