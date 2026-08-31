import {create} from "zustand";

import {fetchAgentTools, runAgentCoreDemo} from "../lib/agent-core-api";
import type {LoadState} from "@/types/sessions";
import type {AgentCoreDemoData, ToolDefinition} from "@/types/agent-core";

type AgentCoreState = {
    demo: LoadState<AgentCoreDemoData | null>;
    running: boolean;
    selectedToolName: string | null;
    task: string;
    tools: LoadState<ToolDefinition[]>;
};

type AgentCoreActions = {
    loadTools: () => Promise<void>;
    runDemo: () => Promise<void>;
    setSelectedToolName: (toolName: string | null) => void;
    setTask: (task: string) => void;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "unknown error";
}

const useAgentCoreStore = create<AgentCoreState & AgentCoreActions>(
    (set, get) => ({
        demo: {type: "ready", data: null},
        running: false,
        selectedToolName: null,
        task: "帮我拆解一个 Agent 工具调用流程",
        tools: {type: "loading"},

        setSelectedToolName: (toolName) => set({selectedToolName: toolName}),
        setTask: (task) => set({task}),

        loadTools: async () => {
            set({tools: {type: "loading"}});
            try {
                const tools = await fetchAgentTools();
                set((state) => ({
                    selectedToolName: state.selectedToolName ?? tools[0]?.name ?? null,
                    tools: {type: "ready", data: tools},
                }));
            } catch (error) {
                set({tools: {type: "error", message: getErrorMessage(error)}});
            }
        },

        runDemo: async () => {
            const task = get().task.trim();
            if (!task) {
                set({demo: {type: "error", message: "请输入一个任务"}});
                return;
            }

            set({demo: {type: "loading"}, running: true});
            try {
                const demo = await runAgentCoreDemo(task, get().selectedToolName);
                set({demo: {type: "ready", data: demo}});
            } catch (error) {
                set({demo: {type: "error", message: getErrorMessage(error)}});
            } finally {
                set({running: false});
            }
        },
    }),
);

export default useAgentCoreStore;
