import { requestApi } from "./api";
import type {
  ThinkingComparisonData,
  ThinkingModeListData,
} from "@/types/agent-thinking";

// 读取思维模式说明
export function fetchThinkingModes() {
  return requestApi<ThinkingModeListData>("/api/agent-thinking/modes").then(
    (data) => data.items,
  );
}

// 提交任务并生成多模式对比
export function compareThinkingModes(task: string) {
  return requestApi<ThinkingComparisonData>("/api/agent-thinking/compare", {
    method: "POST",
    body: JSON.stringify({ task }),
  });
}
