import type { ApiResponse } from "@/types/api";

export async function requestApi<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  if (payload.data === null) {
    throw new Error("empty response");
  }
  return payload.data;
}