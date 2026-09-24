import { requestApi } from "@/lib/api";
import type { MultiAgentRoleListData } from "@/types/mutil-agent";

export function fetchMultiAgentRoles(): Promise<MultiAgentRoleListData> {
  return requestApi<MultiAgentRoleListData>("/api/multi-agent/roles");
}
