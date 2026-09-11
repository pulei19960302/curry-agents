import {
  Bot,
  Camera,
  FileText,
  FolderOpen,
  Globe,
  Hammer,
  RefreshCcw,
  Search,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";

import SandboxStatusPanel from "./sandbox-status-panel";
import SessionFilePanel from "./session-file-panel";
import VncPanel from "./vnc-panel";
import { formatDateTime } from "@/lib/format";
import type { VncStatusData } from "@/types/vnc";
import { LoadState, SessionEventItem, SessionFileItem } from "@/types/sessions";
import { FilePreviewData } from "@/types/files";
import { SandboxInstanceData } from "@/types/sandbox";

type ToolPreviewPanelProps = {
  events: LoadState<SessionEventItem[]>; // 会话事件列表，用来提取最近工具调用。
  files: LoadState<SessionFileItem[]>; // 会话文件列表，文件工具和附件都会沉淀到这里。
  onPreviewFile: (fileId: string) => void;
  onRefreshSandbox: () => void;
  onRefreshVnc: () => void;
  onSelectFile: (file: SessionFileItem) => void;
  preview: LoadState<FilePreviewData | null>;
  sandbox: LoadState<SandboxInstanceData>; // 当前任务沙箱状态。
  sandboxRefreshing: boolean;
  selectedFile: SessionFileItem | null;
  vnc: LoadState<VncStatusData>; // VNC 连接信息，用于浏览器实时观察。
};

type PreviewTab = "tools" | "files" | "environment";

type ScreenshotPayload = {
  kind: "browser_screenshot";
  mime_type: string;
  base64_data: string;
  size: number;
};

type SearchResultsPayload = {
  kind: "search_results";
  provider: string;
  query: string;
  items: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
};

// 统一展示工具调用、文件和沙箱观察
export default function ToolPreviewPanel({
  events,
  files,
  onPreviewFile,
  onRefreshSandbox,
  onRefreshVnc,
  onSelectFile,
  preview,
  sandbox,
  sandboxRefreshing,
  selectedFile,
  vnc,
}: ToolPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("tools");
  const toolEvents = useMemo(() => getToolEvents(events), [events]);
  const latestToolEvent = toolEvents[0] ?? null;

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Hammer size={17} aria-hidden="true" />
            工具预览
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            观察 Agent 调用工具、读写文件和操作浏览器的过程
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
        <TabButton active={activeTab === "tools"} onClick={() => setActiveTab("tools")}>
          工具
        </TabButton>
        <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
          文件
        </TabButton>
        <TabButton active={activeTab === "environment"} onClick={() => setActiveTab("environment")}>
          环境
        </TabButton>
      </div>

      <div className="mt-4">
        {activeTab === "tools" ? (
          <ToolCallView events={events} latestToolEvent={latestToolEvent} toolEvents={toolEvents} />
        ) : null}

        {activeTab === "files" ? (
          <SessionFilePanel
            files={files}
            onPreview={onPreviewFile}
            onSelectFile={onSelectFile}
            preview={preview}
            selectedFile={selectedFile}
          />
        ) : null}

        {activeTab === "environment" ? (
          <div className="grid gap-4">
            <SandboxStatusPanel
              onRefresh={onRefreshSandbox}
              refreshing={sandboxRefreshing}
              state={sandbox}
            />
            <VncPanel onRefresh={onRefreshVnc} state={vnc} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded px-3 py-2 font-medium transition ${
        active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ToolCallView({
  events,
  latestToolEvent,
  toolEvents,
}: {
  events: LoadState<SessionEventItem[]>;
  latestToolEvent: SessionEventItem | null;
  toolEvents: SessionEventItem[];
}) {
  if (events.type === "loading") {
    return <EmptyState icon={RefreshCcw} text="正在读取工具事件..." />;
  }

  if (events.type === "error") {
    return <p className="text-sm text-rose-600">{events.message}</p>;
  }

  if (!latestToolEvent) {
    return <EmptyState icon={Bot} text="执行计划后，工具调用会显示在这里。" />;
  }

  return (
    <div className="grid gap-4">
      <ToolCallDetail event={latestToolEvent} />
      <div>
        <h3 className="text-sm font-semibold text-slate-900">最近工具调用</h3>
        <div className="mt-2 grid gap-2">
          {toolEvents.slice(0, 5).map((event) => (
            <ToolCallSummary event={event} key={event.id} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCallDetail({ event }: { event: SessionEventItem }) {
  const toolName = getString(event.payload.tool_name);
  const output = getString(event.payload.output);
  const screenshot = parseScreenshot(output);
  const searchResults = parseSearchResults(output);
  const Icon = getToolIcon(toolName, screenshot, searchResults);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 shrink-0 text-slate-500" size={17} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-semibold text-slate-950">
              {toolName || "tool_called"}
            </h3>
            <span className="shrink-0 text-xs text-slate-500">
              {formatDateTime(event.created_at)}
            </span>
          </div>
          <ToolArguments value={event.payload.arguments} />
          {screenshot ? (
            <ScreenshotPreview screenshot={screenshot} />
          ) : searchResults ? (
            <SearchResultsPreview results={searchResults} />
          ) : (
            <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-white p-3 text-xs leading-5 whitespace-pre-wrap text-slate-700">
              {output || "<no output>"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolCallSummary({ event }: { event: SessionEventItem }) {
  const toolName = getString(event.payload.tool_name);
  const output = getString(event.payload.output);
  const screenshot = parseScreenshot(output);
  const searchResults = parseSearchResults(output);
  const Icon = getToolIcon(toolName, screenshot, searchResults);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="shrink-0 text-slate-500" size={15} aria-hidden="true" />
        <span className="truncate font-medium text-slate-800">{toolName || "tool"}</span>
      </div>
      <span className="shrink-0 text-xs text-slate-500">{formatDateTime(event.created_at)}</span>
    </div>
  );
}

function ToolArguments({ value }: { value: unknown }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-medium text-slate-500">调用参数</div>
      <pre className="max-h-28 overflow-auto rounded-md bg-white p-2 text-[11px] leading-5 text-slate-600">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function ScreenshotPreview({ screenshot }: { screenshot: ScreenshotPayload }) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
      <img
        alt="浏览器截图"
        className="max-h-64 w-full object-contain"
        src={`data:${screenshot.mime_type};base64,${screenshot.base64_data}`}
      />
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        {screenshot.mime_type} · {screenshot.size} bytes
      </div>
    </div>
  );
}

function SearchResultsPreview({ results }: { results: SearchResultsPayload }) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-xs font-medium text-slate-500">搜索结果</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">{results.query}</div>
        <div className="mt-1 text-xs text-slate-500">provider: {results.provider}</div>
      </div>
      <div className="grid gap-2 p-3">
        {results.items.map((item) => (
          <a
            className="block rounded-md border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50"
            href={item.url}
            key={`${item.title}-${item.url}`}
            rel="noreferrer"
            target="_blank"
          >
            <div className="line-clamp-1 text-sm font-semibold text-slate-950">
              {item.title || item.url}
            </div>
            <div className="mt-1 line-clamp-1 text-xs text-sky-700">{item.url}</div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
              {item.snippet || "暂无摘要"}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Bot; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
      <Icon size={16} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

function getToolEvents(state: LoadState<SessionEventItem[]>): SessionEventItem[] {
  if (state.type !== "ready") {
    return [];
  }
  return [...state.data]
    .filter((event) => event.type === "tool_called")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getToolIcon(
  toolName: string,
  screenshot: ScreenshotPayload | null,
  searchResults: SearchResultsPayload | null,
) {
  if (screenshot) {
    return Camera;
  }
  if (searchResults || toolName.startsWith("search_")) {
    return Search;
  }
  if (toolName.startsWith("browser_")) {
    return Globe;
  }
  if (toolName.startsWith("shell_")) {
    return Terminal;
  }
  if (toolName.startsWith("file_")) {
    return FileText;
  }
  if (toolName.includes("list")) {
    return FolderOpen;
  }
  return Hammer;
}

function parseScreenshot(value: string): ScreenshotPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<ScreenshotPayload>;
    if (
      payload.kind === "browser_screenshot" &&
      typeof payload.mime_type === "string" &&
      typeof payload.base64_data === "string" &&
      typeof payload.size === "number"
    ) {
      return payload as ScreenshotPayload;
    }
  } catch {
    return null;
  }
  return null;
}

function parseSearchResults(value: string): SearchResultsPayload | null {
  try {
    // SearchTool 的 output 是 JSON 字符串。
    // 只有 kind=search_results 时，才按搜索结果卡片渲染；其他工具输出继续走普通文本。
    const payload = JSON.parse(value) as Partial<SearchResultsPayload>;
    if (
      payload.kind === "search_results" &&
      typeof payload.provider === "string" &&
      typeof payload.query === "string" &&
      Array.isArray(payload.items)
    ) {
      return {
        kind: "search_results",
        provider: payload.provider,
        query: payload.query,
        items: payload.items.map((item) => ({
          title: getString(item.title),
          url: getString(item.url),
          snippet: getString(item.snippet),
        })),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
