import { Bot, Braces, Hammer, Loader2, MessageCircle } from "lucide-react";

import type {
  AgentCoreDemoData,
  MemoryMessage,
  ToolDefinition,
} from "@/types/agent-core";

import type { LoadState } from "@/types/sessions";

type AgentCorePanelProps = {
  demo: LoadState<AgentCoreDemoData | null>;
  onRun: () => void;
  onTaskChange: (task: string) => void;
  onToolChange: (toolName: string | null) => void;
  running: boolean;
  selectedToolName: string | null;
  task: string;
  tools: LoadState<ToolDefinition[]>;
};

export default function AgentCorePanel({
  demo,
  onRun,
  onTaskChange,
  onToolChange,
  running,
  selectedToolName,
  task,
  tools,
}: AgentCorePanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Agent 记忆与工具协议
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            运行一次最小 Agent 调用，观察用户任务、工具选择、工具结果如何进入
            Memory。
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={running}
          onClick={onRun}
          type="button"
        >
          {running ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Bot size={16} />
          )}
          运行演示
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_280px] gap-4 max-xl:grid-cols-1">
        <div className="space-y-3">
          <textarea
            className="min-h-24 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 outline-none focus:border-slate-400"
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder="输入一个要交给 Agent 处理的任务"
            value={task}
          />
          <ToolSelector
            onToolChange={onToolChange}
            selectedToolName={selectedToolName}
            state={tools}
          />
        </div>

        <ToolSchemaList state={tools} />
      </div>

      <div className="mt-5">
        <DemoResult state={demo} />
      </div>
    </section>
  );
}

function ToolSelector({
  onToolChange,
  selectedToolName,
  state,
}: {
  onToolChange: (toolName: string | null) => void;
  selectedToolName: string | null;
  state: LoadState<ToolDefinition[]>;
}) {
  if (state.type !== "ready") {
    return null;
  }

  return (
    <label className="block text-sm text-slate-600">
      <span className="mb-2 block font-medium text-slate-700">选择工具</span>
      <select
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
        onChange={(event) => onToolChange(event.target.value || null)}
        value={selectedToolName ?? ""}
      >
        {state.data.map((tool) => (
          <option key={tool.name} value={tool.name}>
            {tool.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolSchemaList({ state }: { state: LoadState<ToolDefinition[]> }) {
  if (state.type === "loading") {
    return <SmallState text="工具加载中" />;
  }
  if (state.type === "error") {
    return <SmallState text={state.message} tone="error" />;
  }

  return (
    <div className="grid gap-2">
      {state.data.map((tool) => (
        <div
          className="rounded-md border border-slate-200 bg-slate-50 p-3"
          key={tool.name}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
            <Hammer size={16} aria-hidden="true" />
            {tool.name}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {tool.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tool.parameters.map((parameter) => (
              <code
                className="rounded bg-white px-2 py-1 text-xs text-slate-700"
                key={parameter.name}
              >
                {parameter.name}: {parameter.type}
              </code>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DemoResult({ state }: { state: LoadState<AgentCoreDemoData | null> }) {
  if (state.type === "loading") {
    return <SmallState text="正在运行 Agent 核心演示" />;
  }
  if (state.type === "error") {
    return <SmallState text={state.message} tone="error" />;
  }
  if (!state.data) {
    return <SmallState text="点击运行演示后，这里会展示 Memory 和工具结果" />;
  }

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4 max-xl:grid-cols-1">
      <MemoryTimeline messages={state.data.messages} />
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Braces size={16} aria-hidden="true" />
            工具结果
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {state.data.tool_result.tool_name}
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-xs leading-5 text-slate-700">
            {state.data.tool_result.output}
          </pre>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {state.data.next_step}
        </div>
      </div>
    </div>
  );
}

function MemoryTimeline({ messages }: { messages: MemoryMessage[] }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <MessageCircle size={16} aria-hidden="true" />
        Memory
      </div>
      <div className="mt-4 grid gap-3">
        {messages.map((message) => (
          <div className="rounded-md bg-white p-3" key={message.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500">
                {message.role}
                {message.name ? ` / ${message.name}` : ""}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {message.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallState({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          : "rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500"
      }
    >
      {text}
    </div>
  );
}
