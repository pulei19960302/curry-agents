import { Box, CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";

import type { SandboxInstanceData } from "@/types/sandbox";
import type { LoadState } from "@/types/sessions";

type SandboxStatusPanelProps = {
  onRefresh: () => void;
  refreshing: boolean;
  state: LoadState<SandboxInstanceData>;
};

// 展示当前任务沙箱状态
export default function SandboxStatusPanel({
  onRefresh,
  refreshing,
  state,
}: SandboxStatusPanelProps) {
  const view = buildSandboxView(state);
  const Icon = view.icon;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">任务沙箱</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">当前会话使用的 Sandbox 运行状态</p>
        </div>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          disabled={refreshing}
          onClick={onRefresh}
          title="刷新沙箱状态"
          type="button"
        >
          {refreshing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <Icon className={view.iconClassName} size={18} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">{view.title}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{view.message}</p>
        </div>
      </div>

      {state.type === "ready" ? (
        <dl className="mt-4 grid gap-2 text-xs text-slate-600">
          <div className="flex justify-between gap-3">
            <dt>实例</dt>
            <dd className="truncate font-medium text-slate-900">{state.data.id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>容器</dt>
            <dd className="truncate font-medium text-slate-900">{state.data.name}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>状态</dt>
            <dd className="truncate font-medium text-slate-900">{state.data.status}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function buildSandboxView(state: LoadState<SandboxInstanceData>) {
  if (state.type === "loading") {
    return {
      icon: Loader2,
      iconClassName: "animate-spin text-slate-500",
      message: "正在检查 Sandbox 健康状态",
      title: "检测中",
    };
  }
  if (state.type === "error") {
    return {
      icon: XCircle,
      iconClassName: "text-rose-600",
      message: state.message,
      title: "沙箱异常",
    };
  }
  if (state.data.status === "ready") {
    return {
      icon: CheckCircle2,
      iconClassName: "text-emerald-600",
      message: state.data.message,
      title: "沙箱可用",
    };
  }
  return {
    icon: Box,
    iconClassName: "text-amber-600",
    message: state.data.message,
    title: "沙箱未就绪",
  };
}
