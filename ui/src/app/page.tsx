"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Box,
  CheckCircle2,
  Clock3,
  FileText,
  Folder,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "./constants/api";
import type { ApiResponse, ApiStatusData } from "./types/api";

type StatusState =
  | { type: "loading"; data: null; message: null }
  | { type: "ready"; data: ApiStatusData; message: null }
  | { type: "error"; data: null; message: string };

const navigation = [
  { label: "工作台", icon: LayoutDashboard, active: true },
  { label: "会话", icon: MessageSquare },
  { label: "文件", icon: Folder },
  { label: "沙箱", icon: Box },
  { label: "设置", icon: Settings },
];

const capabilities = [
  {
    title: "智能会话",
    description: "连接 Agent，持续处理多轮任务与上下文。",
    icon: Bot,
    color: "bg-violet-100 text-violet-700",
  },
  {
    title: "文件管理",
    description: "统一查看任务输入、产物与过程文件。",
    icon: FileText,
    color: "bg-sky-100 text-sky-700",
  },
  {
    title: "沙箱执行",
    description: "在隔离环境中安全运行代码和命令。",
    icon: Terminal,
    color: "bg-emerald-100 text-emerald-700",
  },
];

const flowSteps = [
  { label: "创建任务", detail: "描述目标与交付要求", state: "done" },
  { label: "Agent 执行", detail: "分析、调用工具并生成结果", state: "active" },
  { label: "确认产物", detail: "查看结果并继续迭代", state: "pending" },
];

export default function Page() {
  const [status, setStatus] = useState<StatusState>({
    type: "loading",
    data: null,
    message: null,
  });

  useEffect(() => {
    let ignore = false;

    async function loadStatus() {
      try {
        const response = await fetch(API_ENDPOINTS.STATUS);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse<ApiStatusData>;
        if (!payload.data) {
          throw new Error(payload.message);
        }

        if (!ignore) {
          setStatus({ type: "ready", data: payload.data, message: null });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown error";
        if (!ignore) {
          setStatus({ type: "error", data: null, message });
        }
      }
    }

    loadStatus();

    return () => {
      ignore = true;
    };
  }, []);

  const isReady = status.type === "ready";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 px-5 lg:h-20 lg:px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="font-semibold tracking-tight">CurryAgent</p>
            <p className="text-xs text-slate-500">Agent Workspace</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4 lg:py-4">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:w-full ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 lg:ml-64">
        <header className="border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur lg:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">工作台</p>
              <h1 className="text-xl font-semibold tracking-tight">欢迎回来</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              <span
                className={`size-2 rounded-full ${
                  isReady
                    ? "bg-emerald-500"
                    : status.type === "error"
                      ? "bg-rose-500"
                      : "animate-pulse bg-amber-400"
                }`}
              />
              {isReady
                ? "系统运行正常"
                : status.type === "error"
                  ? "API 连接异常"
                  : "正在检查服务"}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-10">
          <section className="overflow-hidden rounded-2xl bg-slate-900 px-6 py-7 text-white shadow-sm sm:px-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-sm font-medium text-sky-300">
                  CurryAgent 控制中心
                </p>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  从一个清晰的工作台开始你的 Agent 任务
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  查看服务状态、组织文件，并跟踪任务从创建到完成的整个过程。
                </p>
              </div>
              <button
                type="button"
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                创建新任务
                <ArrowRight size={16} />
              </button>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">API 状态</p>
                  <h2 className="mt-1 text-lg font-semibold">后端服务</h2>
                </div>
                <div
                  className={`flex size-10 items-center justify-center rounded-xl ${
                    isReady
                      ? "bg-emerald-100 text-emerald-700"
                      : status.type === "error"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Activity size={20} />
                </div>
              </div>

              {isReady ? (
                <div className="mt-6">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 size={18} />
                    服务连接正常
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                    <div>
                      <dt className="text-xs text-slate-400">服务名称</dt>
                      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {status.data.service}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">运行环境</dt>
                      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {status.data.environment}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">服务状态</dt>
                      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {status.data.status}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-400">版本</dt>
                      <dd className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {status.data.version}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-3">
                  <Clock3 className="text-slate-400" size={22} />
                  <div>
                    <p className="font-semibold">
                      {status.type === "error" ? "连接失败" : "正在连接"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {status.message ?? "正在读取服务状态..."}
                    </p>
                  </div>
                </div>
              )}
            </article>

            <div className="grid gap-4 sm:grid-cols-3">
              {capabilities.map(({ title, description, icon: Icon, color }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${color}`}
                  >
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">任务流预览</p>
                <h2 className="mt-1 text-lg font-semibold">一次任务如何完成</h2>
              </div>
              <span className="hidden text-xs text-slate-400 sm:block">
                示例流程
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {flowSteps.map((step, index) => (
                <div
                  key={step.label}
                  className="relative rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                        step.state === "done"
                          ? "bg-emerald-600 text-white"
                          : step.state === "active"
                            ? "bg-slate-900 text-white"
                            : "border border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className="font-medium">{step.label}</p>
                  </div>
                  <p className="mt-3 pl-10 text-sm leading-5 text-slate-500">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
