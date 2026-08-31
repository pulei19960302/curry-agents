import { create } from "zustand";

import {
  createSession,
  deleteSession,
  fetchEvents,
  fetchMessages,
  fetchSessions,
  sendMessageToStream,
  stopSession,
  clearUnread,
  fetchSessionFiles,
  uploadSessionFile,
  createPlan,
} from "../lib/session-api";

import type {
  LoadState,
  SessionEventItem,
  ChatMessage,
  SessionItem,
  SessionFileItem,
} from "@/types/sessions";
import { StreamEvent } from "@/types/base";
import { FilePreviewData } from "@/types/files";
import { fetchFilePreview } from "@/lib/files-api";
import type { AgentPlan } from "@/types/planner";

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
  clearingUnread: boolean;
  stoppingSession: boolean;
  attachments: SessionFileItem[];
  uploadingFile: boolean;
  files: LoadState<SessionFileItem[]>;
  filePreview: LoadState<FilePreviewData | null>;
  selectedFile: SessionFileItem | null;
  latestPlan: AgentPlan | null;
  planning: boolean;
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
  clearUnread: () => Promise<void>;
  stopSession: () => Promise<void>;
  uploadAttachment: (file: File) => Promise<void>;
  loadFilePreview: (fileId: string) => Promise<void>;
  selectFile: (file: SessionFileItem | null) => void;
  createPlan: () => Promise<void>;
};

const initialDetailState = {
  messages: { type: "ready", data: [] } as LoadState<ChatMessage[]>,
  events: { type: "ready", data: [] } as LoadState<SessionEventItem[]>,
  files: { type: "ready", data: [] } as LoadState<SessionFileItem[]>,
  filePreview: {
    type: "ready",
    data: null,
  } as LoadState<FilePreviewData | null>,
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

function updateSession(items: SessionItem[], nextSession: SessionItem) {
  return items.map((item) => (item.id === nextSession.id ? nextSession : item));
}

function toPlan(event: SessionEventItem): AgentPlan | null {
  if (event.type !== "plan_created") {
    return null;
  }
  const payload = event.payload as Partial<AgentPlan>;
  if (
    !payload.id ||
    !payload.title ||
    !payload.goal ||
    !payload.source ||
    !Array.isArray(payload.steps)
  ) {
    return null;
  }
  return {
    id: String(payload.id),
    title: String(payload.title),
    goal: String(payload.goal),
    source: String(payload.source),
    steps: payload.steps,
  };
}

function getLatestPlan(events: SessionEventItem[]) {
  return (
    [...events]
      .reverse()
      .map(toPlan)
      .find((plan): plan is AgentPlan => plan !== null) ?? null
  );
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
  clearingUnread: false,
  stoppingSession: false,
  attachments: [],
  uploadingFile: false,
  files: initialDetailState.files,
  filePreview: initialDetailState.filePreview,
  selectedFile: null,
  latestPlan: null,
  planning: false,

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

  loadSessionDetail: async (sessionId) => {
    set({
      events: { type: "loading" },
      files: { type: "loading" },
      filePreview: { type: "ready", data: null },
      messages: { type: "loading" },
      selectedFile: null,
    });
    try {
      const [messages, events, files] = await Promise.all([
        fetchMessages(sessionId),
        fetchEvents(sessionId),
        fetchSessionFiles(sessionId),
      ]);
      set({
        events: { type: "ready", data: events },
        files: { type: "ready", data: files },
        latestPlan: getLatestPlan(events),
        messages: { type: "ready", data: messages },
      });
    } catch (error) {
      const message = getErrorMessage(error);
      set({
        actionError: message,
        events: { type: "error", message },
        files: { type: "error", message },
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

  stopSession: async () => {
    const sessionId = get().selectedSessionId;
    if (!sessionId) {
      set({ actionError: "请先选择一个会话" });
      return;
    }

    set({ actionError: null, stoppingSession: true });
    try {
      const session = await stopSession(sessionId);
      set((state) => ({
        sessions:
          state.sessions.type === "ready"
            ? {
                type: "ready",
                data: updateSession(state.sessions.data, session),
              }
            : state.sessions,
      }));
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ stoppingSession: false });
    }
  },
  clearUnread: async () => {
    const sessionId = get().selectedSessionId;
    if (!sessionId) {
      set({ actionError: "请先选择一个会话" });
      return;
    }

    set({ actionError: null, clearingUnread: true });
    try {
      const session = await clearUnread(sessionId);
      set((state) => ({
        sessions:
          state.sessions.type === "ready"
            ? {
                type: "ready",
                data: updateSession(state.sessions.data, session),
              }
            : state.sessions,
      }));
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ clearingUnread: false });
    }
  },

  uploadAttachment: async (file: File) => {
    if (!get().selectedSessionId) {
      set({ actionError: "请先选择一个会话" });
      return;
    }

    set({ actionError: null, uploadingFile: true });
    try {
      const uploaded = await uploadSessionFile(get().selectedSessionId!, file);
      set((state) => ({
        attachments: [uploaded, ...state.attachments],
        files:
          state.files.type === "ready"
            ? {
                type: "ready",
                data: [uploaded, ...state.files.data],
              }
            : state.files,
      }));
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ uploadingFile: false });
    }
  },

  selectFile: (file) => {
    set({
      filePreview: { type: "ready", data: null },
      selectedFile: file,
    });
  },

  loadFilePreview: async (fileId) => {
    set({ actionError: null, filePreview: { type: "loading" } });
    try {
      const preview = await fetchFilePreview(fileId);
      set({ filePreview: { type: "ready", data: preview } });
    } catch (error) {
      const message = getErrorMessage(error);
      set({
        actionError: message,
        filePreview: { type: "error", message },
      });
    }
  },
  createPlan: async () => {
    const sessionId = get().selectedSessionId;
    if (!sessionId) {
      set({ actionError: "请先选择一个会话" });
      return;
    }

    const messageState = get().messages;
    const currentMessages =
      messageState.type === "ready" ? messageState.data : [];
    const latestUserMessage = [...currentMessages]
      .reverse()
      .find((message) => message.role === "user");
    const task = get().draft.trim() || latestUserMessage?.content.trim() || "";
    if (!task) {
      set({ actionError: "请输入任务，或先发送一条用户消息" });
      return;
    }

    set({ actionError: null, planning: true });
    try {
      const result = await createPlan(sessionId, task);
      set((state) => {
        const currentEvents =
          state.events.type === "ready" ? state.events.data : [];
        const events = [...currentEvents, result.event];
        return {
          events: { type: "ready", data: events },
          latestPlan: result.plan,
        };
      });
      await get().refreshSessions();
    } catch (error) {
      set({ actionError: getErrorMessage(error) });
    } finally {
      set({ planning: false });
    }
  },
}));

export default useSessionStore;
