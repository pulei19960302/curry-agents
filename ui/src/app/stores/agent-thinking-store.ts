import { create } from "zustand";

import {
  compareThinkingModes,
  fetchThinkingModes,
} from "@/lib/agent-thinking-api";

import type { LoadState } from "@/types/sessions";

import type {
  ThinkingComparisonData,
  ThinkingModeInfo,
} from "@/types/agent-thinking";

type AgentThinkingState = {
  comparison: LoadState<ThinkingComparisonData | null>;
  modes: LoadState<ThinkingModeInfo[]>;
  running: boolean;
  task: string;
};

type AgentThinkingActions = {
  loadModes: () => Promise<void>;
  runComparison: () => Promise<void>;
  setTask: (task: string) => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

const useAgentThinkingStore = create<AgentThinkingState & AgentThinkingActions>(
  (set, get) => ({
    comparison: { type: "ready", data: null },
    modes: { type: "loading" },
    running: false,
    task: "帮我从 0 到 1 实现一个 AI Agent 项目",

    setTask: (task) => set({ task }),

    loadModes: async () => {
      set({ modes: { type: "loading" } });
      try {
        const modes = await fetchThinkingModes();
        set({ modes: { type: "ready", data: modes } });
      } catch (error) {
        set({ modes: { type: "error", message: getErrorMessage(error) } });
      }
    },

    runComparison: async () => {
      const task = get().task.trim();
      if (!task) {
        set({
          comparison: { type: "error", message: "请输入一个要分析的任务" },
        });
        return;
      }

      set({ comparison: { type: "loading" }, running: true });
      try {
        const comparison = await compareThinkingModes(task);
        set({ comparison: { type: "ready", data: comparison } });
      } catch (error) {
        set({
          comparison: { type: "error", message: getErrorMessage(error) },
        });
      } finally {
        set({ running: false });
      }
    },
  }),
);

export default useAgentThinkingStore;
