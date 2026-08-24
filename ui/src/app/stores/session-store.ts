import { create } from "zustand";

import {
  createSession,
  deleteSession,
  fetchEvents,
  fetchMessages,
  fetchSessions,
  sendMessageToStream,
} from "../lib/session-api";

import type {
  LoadState,
  SessionEventItem,
  ChatMessage,
  SessionItem,
} from "@/types/sessions";
import { StreamEvent } from "@/types/base";

//
export type SessionState = {
  actionError: string | null;
  draft: string;
  events: LoadState<SessionEventItem[]>;
  messages: LoadState<ChatMessage[]>;
  selectedSessionId: string | null;
  sendingMessage: boolean;
  sessions: LoadState<SessionItem[]>;
  submitting: boolean;
  title: string;
};

type SessionActions = {
  createSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  loadSessionDetail: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  sendMessage: () => Promise<void>;
  setActionError: (message: string | null) => void;
  setDraft: (draft: string) => void;
  setTitle: (title: string) => void;
};

const initialDetailState = {
  messages: { type: "ready", data: [] } as LoadState<ChatMessage[]>,
  events: { type: "ready", data: [] } as LoadState<SessionEventItem[]>,
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function toSessionEventItem(event: StreamEvent): SessionEventItem | null {
  if (event.event !== "message_created") {
    return null;
  }
  const data = event.data as Partial<SessionEventItem>;
  if (!data.id || !data.session_id || !data.type || !data.created_at) {
    return null;
  }
  return {
    id: String(data.id),
    session_id: String(data.session_id),
    type: String(data.type),
    payload:
      typeof data.payload === "object" && data.payload !== null
        ? (data.payload as Record<string, unknown>)
        : {},
    created_at: String(data.created_at),
  };
}

const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  actionError: null,
  draft: "",
  events: initialDetailState.events,
  messages: initialDetailState.messages,
  selectedSessionId: null,
  sendingMessage: false,
  sessions: { type: "loading" },
  submitting: false,
  title: "",

  setActionError: (message: string | null) => set({ actionError: message }),

  setDraft: (draft) => set({ draft }),

  setTitle: (title) => set({ title }),

  selectSession: (sessionId) => {
    set({
      selectedSessionId: sessionId,
      ...initialDetailState,
    });
  },

  refreshSessions: async () => {
    set({ actionError: null });

    try {
      const items = await fetchSessions();
      set((state) => {
        const selectedSessionId =
          state.selectedSessionId &&
          items.some((item) => item.id === state.selectedSessionId)
            ? state.selectedSessionId
            : (items[0]?.id ?? null);
        return {
          sessions: { type: "ready", data: items },
          selectedSessionId,
        };
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      set({
        actionError: errorMessage,
        sessions: { type: "error", message: errorMessage },
      });
    }
  },

  loadSessionDetail: async (sessionId: string) => {
    set({
      events: { type: "loading" },
      messages: { type: "loading" },
    });
    try {
      const [messages, events] = await Promise.all([
        fetchMessages(sessionId),
        fetchEvents(sessionId),
      ]);
      set({
        events: { type: "ready", data: events },
        messages: { type: "ready", data: messages },
      });
    } catch (error) {
      const message = getErrorMessage(error);
      set({
        actionError: message,
        events: { type: "error", message },
        messages: { type: "error", message },
      });
    }
  },

  createSession: async () => {
    const cleanTitle = get().title.trim();
    if (!cleanTitle) {
      set({ actionError: "请输入会话标题" });
      return;
    }

    set({ actionError: null, submitting: true });
    try {
      const created = await createSession(cleanTitle);
      set({
        title: "",
        selectedSessionId: created.id,
      });
      await get().refreshSessions();
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ submitting: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ actionError: null });
    try {
      await deleteSession(sessionId);
      await get().refreshSessions();
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    }
  },

  sendMessage: async () => {
    const sessionId = get().selectedSessionId;
    const content = get().draft.trim();
    if (!sessionId) {
      set({ actionError: "请先选择一个会话" });
      return;
    }
    if (!content) {
      set({ actionError: "请输入消息内容" });
      return;
    }

    set({ actionError: null, sendingMessage: true });
    try {
      await sendMessageToStream(sessionId, content, (event) => {
        const sessionEvent = toSessionEventItem(event);
        if (!sessionEvent) {
          return;
        }
        set((state) => {
          const currentEvents =
            state.events.type === "ready" ? state.events.data : [];
          return {
            events: {
              type: "ready",
              data: [...currentEvents, sessionEvent],
            },
          };
        });
      });
      set({ draft: "" });
      await Promise.all([
        get().loadSessionDetail(sessionId),
        get().refreshSessions(),
      ]);
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ sendingMessage: false });
    }
  },
}));

export default useSessionStore;
