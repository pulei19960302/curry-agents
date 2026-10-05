import { requestApi } from "./api";
import type { SecurityCheckListData } from "@/types/security";

export function fetchSecurityChecks(): Promise<SecurityCheckListData> {
  return requestApi<SecurityCheckListData>("/api/security/checks");
}
