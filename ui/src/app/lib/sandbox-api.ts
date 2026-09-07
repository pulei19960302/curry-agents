import { requestApi } from "./api";
import type { SandboxInstanceData } from "@/types/sandbox";

// 读取当前任务沙箱状态
export function fetchCurrentSandbox(): Promise<SandboxInstanceData> {
  return requestApi<SandboxInstanceData>("/api/sandboxes/current");
}

// 等待沙箱通过健康检查
export function waitCurrentSandbox(): Promise<SandboxInstanceData> {
  return requestApi<SandboxInstanceData>("/api/sandboxes/current/wait", {
    method: "POST",
    body: JSON.stringify({
      retries: 3,
      interval_seconds: 1,
    }),
  });
}
