import { requestApi } from "./api";
import type { ObservabilityCheckListData } from "@/types/observability";

export function fetchObservabilityChecks(): Promise<ObservabilityCheckListData> {
  return requestApi<ObservabilityCheckListData>("/api/observability/checks");
}
