import { requestApi } from "@/lib/api";
import { readSseStream } from "./sse";

import type {
  ChatMessage,
  MessageListData,
  SessionEventItem,
  SessionEventListData,
  MessageCreateData,
  SessionItem,
  SessionListData,
  SessionFileItem,
  SessionFileListData,
} from "@/types/sessions";

import type { StreamEvent } from "@/types/base";

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

export async function sendMessageToStream(
  sessionId: string,
  content: string,
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetch(`/api/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  await readSseStream(response, onEvent);
}

export function stopSession(sessionId: string): Promise<SessionItem> {
  return requestApi<SessionItem>(`/api/sessions/${sessionId}/stop`, {
    method: "POST",
  });
}

export function clearUnread(sessionId: string): Promise<SessionItem> {
  return requestApi<SessionItem>(`/api/sessions/${sessionId}/read`, {
    method: "POST",
  });
}


export function fetchSessionFiles(sessionId: string): Promise<SessionFileItem[]> {
  return requestApi<SessionFileListData>(`/api/sessions/${sessionId}/files`).then(
    (data) => data.items,
  );
}

export async function uploadSessionFile(
  sessionId: string,
  file: File,
): Promise<SessionFileItem> {
  const formData = new FormData();
  formData.append("upload", file);

  const response = await fetch(`/api/sessions/${sessionId}/upload_file`, {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as {
    code: number;
    message: string;
    data: SessionFileItem | null;
  };
  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  if (!payload.data) {
    throw new Error("empty response");
  }
  return payload.data;
}