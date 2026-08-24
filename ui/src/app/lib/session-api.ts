import { requestApi } from "@/lib/api";

import type {
  ChatMessage,
  MessageListData,
  SessionEventItem,
  SessionEventListData,
  MessageCreateData,
  SessionItem,
  SessionListData,
} from "@/types/sessions";

export function fetchSessions(): Promise<SessionItem[]> {
  return requestApi<SessionListData>(`/api/sessions`).then(
    (data) => data.items,
  );
}

export function createSession(title: string): Promise<SessionItem> {
  return requestApi<SessionItem>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function deleteSession(sessionId: string): Promise<void> {
  return requestApi<void>(`/api/sessions/${sessionId}`, { method: "DELETE" });
}

export function fetchMessages(sessionId: string): Promise<ChatMessage[]> {
  return requestApi<MessageListData>(
    `/api/sessions/${sessionId}/messages`,
  ).then((data) => data.items);
}

export function fetchEvents(sessionId: string): Promise<SessionEventItem[]> {
  return requestApi<SessionEventListData>(
    `/api/sessions/${sessionId}/events`,
  ).then((data) => data.items);
}

export function sendMessage(
  sessionId: string,
  content: string,
): Promise<MessageCreateData> {
  return requestApi<MessageCreateData>(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
