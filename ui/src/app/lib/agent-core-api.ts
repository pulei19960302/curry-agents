import { requestApi } from "./api";
import type { AgentCoreDemoData, ToolListData } from "@/types/agent-core";

export function fetchAgentTools() {
  return requestApi<ToolListData>("/api/agent-core/tools").then(
    (data) => data.items,
  );
}

export function runAgentCoreDemo(task: string, toolName: string | null) {
  return requestApi<AgentCoreDemoData>("/api/agent-core/demo", {
    method: "POST",
    body: JSON.stringify({
      task,
      tool_name: toolName,
    }),
  });
}
