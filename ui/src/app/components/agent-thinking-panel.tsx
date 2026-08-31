import {
  Brain,
  GitBranch,
  Loader2,
  MessageSquareText,
  Wrench,
} from "lucide-react";

import type { LoadState } from "@/types/sessions";

import type {
  ThinkingComparisonData,
  ThinkingModeDemo,
  ThinkingModeInfo,
} from "@/types/agent-thinking";

type AgentThinkingPanelProps = {
  comparison: LoadState<ThinkingComparisonData | null>;
  modes: LoadState<ThinkingModeInfo[]>;
  onRun: () => void;
  onTaskChange: (task: string) => void;
  running: boolean;
  task: string;
};

const modeIcons: Record<string, typeof MessageSquareText> = {
  chatbot: MessageSquareText,
  cot: Brain,
  react: Wrench,
  decomposition: GitBranch,
};

export default function AgentThinkingPanel({
  comparison,
  modes,
  onRun,
  onTaskChange,
  running,
  task,
}: AgentThinkingPanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Agent 思维模型
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            用同一个任务对比普通 ChatBot、CoT、ReAct
            和任务拆解。这里展示的是可解释的过程摘要， 不是模型隐藏推理内容。
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
            <Brain size={16} />
          )}
          生成对比
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_220px] gap-4 max-xl:grid-cols-1">
        <textarea
          className="min-h-24 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-900 outline-none focus:border-slate-400"
          onChange={(event) => onTaskChange(event.target.value)}
          placeholder="输入一个想让 Agent 完成的任务"
          value={task}
        />
        <ModeList state={modes} />
      </div>

      <div className="mt-5">
        <ComparisonResult state={comparison} />
      </div>
    </section>
  );
}

function ModeList({ state }: { state: LoadState<ThinkingModeInfo[]> }) {
  if (state.type === "loading") {
    return <SmallState text="模式加载中" />;
  }
  if (state.type === "error") {
    return <SmallState text={state.message} tone="error" />;
  }

  return (
    <div className="grid gap-2">
      {state.data.map((mode) => {
        const Icon = modeIcons[mode.mode] ?? Brain;
        return (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
            key={mode.mode}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-950">
              <Icon size={16} aria-hidden="true" />
              {mode.name}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {mode.summary}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ComparisonResult({
  state,
}: {
  state: LoadState<ThinkingComparisonData | null>;
}) {
  if (state.type === "loading") {
    return <SmallState text="正在生成对比结果" />;
  }
  if (state.type === "error") {
    return <SmallState text={state.message} tone="error" />;
  }
  if (!state.data) {
    return <SmallState text="点击生成对比后，这里会展示四种处理方式" />;
  }

  return (
    <div>
      <p className="text-sm text-slate-500">当前任务：{state.data.task}</p>
      <div className="mt-4 grid grid-cols-4 gap-4 max-2xl:grid-cols-2 max-lg:grid-cols-1">
        {state.data.demos.map((demo) => (
          <DemoCard demo={demo} key={demo.mode} />
        ))}
      </div>
    </div>
  );
}

function DemoCard({ demo }: { demo: ThinkingModeDemo }) {
  const Icon = modeIcons[demo.mode] ?? Brain;
  return (
    <article className="flex min-h-[360px] flex-col rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon size={18} aria-hidden="true" />
        {demo.name}
      </div>
      <p className="mt-2 text-sm text-slate-600">{demo.headline}</p>

      <ol className="mt-4 grid gap-2">
        {demo.steps.map((step, index) => (
          <li
            className="flex gap-2 text-sm leading-6 text-slate-700"
            key={step}
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {demo.tool_calls.length > 0 ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">可能调用的工具</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {demo.tool_calls.map((tool) => (
              <code
                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                key={tool}
              >
                {tool}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-auto pt-4 text-sm leading-6 text-slate-700">
        {demo.final_answer}
      </p>
    </article>
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
