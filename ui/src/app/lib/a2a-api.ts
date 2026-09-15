import { requestApi } from "./api";
import type { A2aAgentCardData, A2aConceptsData } from "@/types/a2a";

export function fetchA2aConcepts(): Promise<A2aConceptsData> {
  return requestApi<A2aConceptsData>("/api/a2a/concepts");
}

export function fetchA2aAgentCard(): Promise<A2aAgentCardData> {
  return requestApi<A2aAgentCardData>("/api/a2a/demo/agent-card");
}
