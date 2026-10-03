import { CheckCircle2, Plus, RefreshCcw, Settings, Trash2, XCircle } from "lucide-react";
import { useState } from "react";

import type { LoadState } from "@/types/sessions";
import type {
  AppSettingsData,
  SettingsIntegration,
  SettingsIntegrationKind,
  SettingsModule,
} from "@/types/setting";
import MemorySettingsPanel from "@/components/memory-settings-panel";
import HarnessPanel from "@/components/harness-panel";

type SettingsWorkspaceProps = {
  onCreateIntegration: (payload: {
    kind: string;
    name: string;
    description: string;
    endpoint: string;
  }) => void;
  onDeleteIntegration: (integrationId: string) => void;
  onRefresh: () => void;
  onToggleModule: (moduleKey: string, enabled: boolean) => void;
  settings: LoadState<AppSettingsData>;
};

export type IntegrationDraft = {
  kind: SettingsIntegrationKind;
  name: string;
  description: string;
  endpoint: string;
};

// ===================== 第1步：展示真实设置工作台 =====================
export default function SettingsWorkspace({
  onCreateIntegration,
  onDeleteIntegration,
  onRefresh,
  onToggleModule,
  settings,
}: SettingsWorkspaceProps) {
  return (
    <section className="grid gap-5">
      <div className="flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Settings size={19} aria-hidden="true" />
            设置
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            集中管理 LLM、MCP、A2A 和多 Agent 的启用状态与集成入口
          </p>
        </div>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          onClick={onRefresh}
          title="刷新设置"
          type="button"
        >
          <RefreshCcw size={16} aria-hidden="true" />
        </button>
      </div>

      {settings.type === "loading" ? (
        <div className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-500">
          正在读取设置...
        </div>
      ) : null}

      {settings.type === "error" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {settings.message}
        </div>
      ) : null}

      {settings.type === "ready" ? (
        <SettingsReadyView
          data={settings.data}
          onCreateIntegration={onCreateIntegration}
          onDeleteIntegration={onDeleteIntegration}
          onToggleModule={onToggleModule}
        />
      ) : null}
    </section>
  );
}

function SettingsReadyView({
  data,
  onCreateIntegration,
  onDeleteIntegration,
  onToggleModule,
}: {
  data: AppSettingsData;
  onCreateIntegration: SettingsWorkspaceProps["onCreateIntegration"];
  onDeleteIntegration: SettingsWorkspaceProps["onDeleteIntegration"];
  onToggleModule: SettingsWorkspaceProps["onToggleModule"];
}) {
  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        {data.modules.map((module) => (
          <SettingsModuleCard key={module.key} module={module} onToggleModule={onToggleModule} />
        ))}
      </section>

      <MemorySettingsPanel />
      <HarnessPanel />

      <section className="grid grid-cols-[1fr_360px] gap-5 max-xl:grid-cols-1">
        <IntegrationList
          integrations={data.integrations}
          onDeleteIntegration={onDeleteIntegration}
        />
        <IntegrationForm onCreateIntegration={onCreateIntegration} />
      </section>
    </div>
  );
}

// ===================== 第2步：展示单个模块配置 =====================
function SettingsModuleCard({
  module,
  onToggleModule,
}: {
  module: SettingsModule;
  onToggleModule: SettingsWorkspaceProps["onToggleModule"];
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{module.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{module.description}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            checked={module.enabled}
            className="h-4 w-4 accent-slate-950"
            onChange={(event) => onToggleModule(module.key, event.target.checked)}
            type="checkbox"
          />
          启用
        </label>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-500">默认项：</span>
        <span className="font-medium text-slate-900">{module.default_item ?? "未设置"}</span>
      </div>

      <div className="mt-4 grid gap-2">
        {module.items.map((item) => (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            key={`${module.key}-${item.name}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {item.description || "暂无说明"}
                </p>
              </div>
              <StatusPill enabled={item.enabled} />
            </div>
            {Object.keys(item.metadata).length > 0 ? (
              <pre className="mt-2 max-h-24 overflow-auto rounded bg-white p-2 text-[11px] leading-5 text-slate-600">
                {JSON.stringify(item.metadata, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs ${
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {enabled ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {enabled ? "可用" : "未启用"}
    </span>
  );
}

// ===================== 第3步：展示和删除运行时集成记录 =====================
function IntegrationList({
  integrations,
  onDeleteIntegration,
}: {
  integrations: SettingsIntegration[];
  onDeleteIntegration: SettingsWorkspaceProps["onDeleteIntegration"];
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-950">运行时集成</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        新增记录保存在当前 API 进程中，重启后会回到 YAML 配置
      </p>

      <div className="mt-4 grid gap-2">
        {integrations.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            还没有新增运行时集成
          </div>
        ) : null}

        {integrations.map((integration) => (
          <div
            className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
            key={integration.id}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white px-2 py-1 text-xs font-medium text-slate-600">
                  {integration.kind}
                </span>
                <span className="truncate text-sm font-semibold text-slate-900">
                  {integration.name}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {integration.description || "暂无说明"}
              </p>
              {integration.endpoint ? (
                <p className="mt-1 truncate text-xs text-sky-700">{integration.endpoint}</p>
              ) : null}
            </div>
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-rose-600"
              onClick={() => onDeleteIntegration(integration.id)}
              title="删除集成"
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== 第4步：新增运行时集成记录 =====================
function IntegrationForm({
  onCreateIntegration,
}: {
  onCreateIntegration: SettingsWorkspaceProps["onCreateIntegration"];
}) {
  const [draft, setDraft] = useState<IntegrationDraft>({
    kind: "mcp",
    name: "",
    description: "",
    endpoint: "",
  });

  return (
    <form
      className="rounded-md border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        onCreateIntegration(draft);
        setDraft({ kind: "mcp", name: "", description: "", endpoint: "" });
      }}
    >
      <h3 className="text-base font-semibold text-slate-950">新增集成</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">
        先记录配置意图，后续设置页会继续升级为写入配置文件
      </p>

      <label className="mt-4 block text-xs font-medium text-slate-500">
        类型
        <select
          className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              kind: event.target.value as IntegrationDraft["kind"],
            }))
          }
          value={draft.kind}
        >
          <option value="llm">LLM</option>
          <option value="mcp">MCP</option>
          <option value="a2a">A2A</option>
          <option value="multi_agent">多 Agent</option>
        </select>
      </label>

      <label className="mt-3 block text-xs font-medium text-slate-500">
        名称
        <input
          className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          maxLength={120}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          placeholder="例如 custom_mcp"
          value={draft.name}
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-slate-500">
        地址
        <input
          className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
          maxLength={500}
          onChange={(event) =>
            setDraft((current) => ({ ...current, endpoint: event.target.value }))
          }
          placeholder="https://example.com"
          value={draft.endpoint}
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-slate-500">
        说明
        <textarea
          className="mt-1 min-h-24 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
          maxLength={500}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          placeholder="说明这个集成准备做什么"
          value={draft.description}
        />
      </label>

      <button
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!draft.name.trim()}
        type="submit"
      >
        <Plus size={16} aria-hidden="true" />
        新增
      </button>
    </form>
  );
}
