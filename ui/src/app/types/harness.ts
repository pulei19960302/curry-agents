export type HarnessExpectation = {
  required_events: string[]; // 用例必须出现的事件类型。
  required_tools: string[]; // 用例必须调用的工具名。
  required_files: string[]; // 用例必须生成的文件名或文件标识。
  forbidden_events: string[]; // 一旦出现就判定异常的事件类型。
};

export type HarnessCaseItem = {
  id: string;
  title: string;
  task: string;
  description: string;
  tags: string[];
  expectation: HarnessExpectation;
};

export type HarnessCaseListData = {
  items: HarnessCaseItem[];
};

export type HarnessAssertionItem = {
  name: string; // 断言名称，例如 required_tool:browser_open。
  passed: boolean; // true 表示通过。
  detail: string; // 断言解释，失败时会给出缺少项。
};

export type HarnessEventItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type HarnessRunData = {
  id: string;
  case_id: string;
  mode: string;
  status: "passed" | "failed";
  task: string;
  prompt_summary: string;
  events: HarnessEventItem[];
  assertions: HarnessAssertionItem[];
  started_at: string;
  completed_at: string | null;
};

export type HarnessReplayData = {
  run: HarnessRunData;
  events: HarnessEventItem[];
};
