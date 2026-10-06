import { useMemo, useState } from "react";
import {
  Bot,
  Camera,
  FileText,
  FolderOpen,
  GitBranch,
  Globe,
  Hammer,
  Maximize2,
  Monitor,
  Network,
  Plug,
  RefreshCcw,
  Search,
  Terminal,
  X,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { LoadState, SessionEventItem } from "@/types/sessions";
import { parseString } from "@/utils";

type ToolPreviewPanelProps = {
  events: LoadState<SessionEventItem[]>; // 会话事件列表，用来提取最近工具调用。
  onClose: () => void; // 关闭右侧工具预览抽屉。
  selectedToolEventId: string | null; // 中间对话流里选中的工具调用事件。
};

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

type McpToolResultPayload = {
  kind: "mcp_tool_result";
  server_name: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  content: Array<Record<string, unknown>>;
};

type A2aTaskResultPayload = {
  kind: "a2a_task_result";
  agent_key: string;
  remote_agent: string;
  task_id: string;
  status: string;
  input_message: Array<{ kind: string; text: string }>;
  output_message: Array<{ kind: string; text: string }>;
  steps: Array<{ index: number; action: string; detail: string }>;
};

type MultiAgentResultPayload = {
  kind: "multi_agent_result";
  task: string;
  manager: string;
  roles: Array<{
    key: string;
    name: string;
    responsibility: string;
    capability: string;
  }>;
  subtasks: Array<{
    id: string;
    assignee: string;
    title: string;
    instruction: string;
    expected_output: string;
    status: string;
    output: string;
  }>;
  review: {
    reviewer: string;
    status: string;
    comments: string[];
    improvement: string;
  };
  final_answer: string;
};

// ===================== 第1步：统一展示工具调用、文件和沙箱观察 =====================
export default function ToolPreviewPanel({
  events,
  onClose,
  selectedToolEventId,
}: ToolPreviewPanelProps) {
  const [expandedEvent, setExpandedEvent] = useState<SessionEventItem | null>(null);
  const toolEvents = useMemo(() => getToolEvents(events), [events]);
  const selectedToolEvent = toolEvents.find((event) => event.id === selectedToolEventId) ?? null;
  const latestToolEvent = selectedToolEvent ?? toolEvents[0] ?? null;

  return (
    <section className="flex h-full flex-col overflow-hidden border border-white/10 bg-[#08090d] shadow-2xl shadow-black/60">
      <div className="border-b border-white/10 bg-[#0b0d14]/95 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 text-xs font-medium tracking-[0.18em] text-zinc-600 uppercase">
              Tool Workspace
            </div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
              <Monitor size={18} aria-hidden="true" />
              CurryAgent 的电脑
            </h2>
            <p className="mt-1 text-sm leading-5 text-zinc-500">
              查看工具调用、文件、浏览器、远程 Agent 和协作结果
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-zinc-50"
            onClick={onClose}
            title="关闭工具预览"
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#08090d] p-4">
        <ToolCallView
          events={events}
          latestToolEvent={latestToolEvent}
          onExpand={setExpandedEvent}
          toolEvents={toolEvents}
        />
      </div>

      {expandedEvent ? (
        <ToolResultDialog event={expandedEvent} onClose={() => setExpandedEvent(null)} />
      ) : null}
    </section>
  );
}

function ToolCallView({
  events,
  latestToolEvent,
  onExpand,
  toolEvents,
}: {
  events: LoadState<SessionEventItem[]>;
  latestToolEvent: SessionEventItem | null;
  onExpand: (event: SessionEventItem) => void;
  toolEvents: SessionEventItem[];
}) {
  if (events.type === "loading") {
    return <EmptyState icon={RefreshCcw} text="正在读取工具事件..." />;
  }

  if (events.type === "error") {
    return <p className="text-sm text-rose-600">{events.message}</p>;
  }

  if (!latestToolEvent) {
    return <EmptyState icon={Bot} text="发送任务后，工具调用会显示在这里。" />;
  }

  return (
    <div className="grid gap-4">
      <ToolCallDetail event={latestToolEvent} onExpand={onExpand} />
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">最近工具调用</h3>
        <div className="mt-2 grid gap-2">
          {toolEvents.slice(0, 8).map((event) => (
            <ToolCallSummary event={event} key={event.id} onExpand={onExpand} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCallDetail({
  event,
  onExpand,
}: {
  event: SessionEventItem;
  onExpand: (event: SessionEventItem) => void;
}) {
  // 1. 从 tool_called 事件中取出工具名和输出。
  //    后端所有工具结果都会先进入 session_events，再由这个面板统一展示。
  const toolName = parseString(event.payload.tool_name);
  const output = parseString(event.payload.output);

  // 2. 尝试把 output 解析成不同工具的结构化结果。
  //    解析成功就用专门卡片展示，解析失败就回退为普通文本。
  const screenshot = parseScreenshot(output);
  const searchResults = parseSearchResults(output);
  const mcpResult = parseMcpToolResult(output);
  const a2aResult = parseA2aTaskResult(output);
  const multiAgentResult = parseMultiAgentResult(output);

  // 3. 根据工具类型选择图标，让用户快速分辨这次调用属于哪类能力。
  const Icon = getToolIcon(
    toolName,
    screenshot,
    searchResults,
    mcpResult,
    a2aResult,
    multiAgentResult,
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3">
            <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-zinc-50">
              <Icon className="shrink-0 text-blue-400" size={17} aria-hidden="true" />
              {toolName || "tool_called"}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-400 hover:text-zinc-50"
                onClick={() => onExpand(event)}
                title="展开工具详情"
                type="button"
              >
                <Maximize2 size={14} aria-hidden="true" />
                展开详情
              </button>
              <span className="text-xs text-zinc-600">{formatDateTime(event.created_at)}</span>
            </div>
          </div>
          <div className="p-4">
            {screenshot ? (
              <ScreenshotPreview screenshot={screenshot} />
            ) : searchResults ? (
              <SearchResultsPreview results={searchResults} />
            ) : mcpResult ? (
              <McpResultPreview result={mcpResult} />
            ) : a2aResult ? (
              <A2aResultPreview result={a2aResult} />
            ) : multiAgentResult ? (
              <MultiAgentResultPreview result={multiAgentResult} />
            ) : (
              <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 whitespace-pre-wrap text-slate-100">
                {output || "<no output>"}
              </pre>
            )}
            <ToolArguments value={event.payload.arguments} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolResultDialog({ event, onClose }: { event: SessionEventItem; onClose: () => void }) {
  const toolName = parseString(event.payload.tool_name);
  const output = parseString(event.payload.output);
  const screenshot = parseScreenshot(output);
  const searchResults = parseSearchResults(output);
  const mcpResult = parseMcpToolResult(output);
  const a2aResult = parseA2aTaskResult(output);
  const multiAgentResult = parseMultiAgentResult(output);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-6 max-sm:p-3">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-950">
              {toolName || "工具详情"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.created_at)}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden max-lg:grid-cols-1">
          <aside className="overflow-auto border-r border-slate-200 bg-slate-50 p-4 max-lg:border-r-0 max-lg:border-b">
            <ToolArguments value={event.payload.arguments} />
          </aside>
          <main className="overflow-auto p-5">
            {screenshot ? (
              <img
                alt="浏览器截图大图"
                className="mx-auto max-h-full w-full object-contain"
                src={`data:${screenshot.mime_type};base64,${screenshot.base64_data}`}
              />
            ) : searchResults ? (
              <SearchResultsPreview results={searchResults} />
            ) : mcpResult ? (
              <McpResultPreview result={mcpResult} />
            ) : a2aResult ? (
              <A2aResultPreview result={a2aResult} />
            ) : multiAgentResult ? (
              <MultiAgentResultPreview result={multiAgentResult} />
            ) : (
              <pre className="min-h-full rounded-md bg-slate-50 p-4 text-xs leading-5 break-words whitespace-pre-wrap text-slate-700">
                {output || "<no output>"}
              </pre>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ToolCallSummary({
  event,
  onExpand,
}: {
  event: SessionEventItem;
  onExpand: (event: SessionEventItem) => void;
}) {
  const toolName = parseString(event.payload.tool_name);
  const output = parseString(event.payload.output);
  const screenshot = parseScreenshot(output);
  const searchResults = parseSearchResults(output);
  const mcpResult = parseMcpToolResult(output);
  const a2aResult = parseA2aTaskResult(output);
  const multiAgentResult = parseMultiAgentResult(output);
  const Icon = getToolIcon(
    toolName,
    screenshot,
    searchResults,
    mcpResult,
    a2aResult,
    multiAgentResult,
  );

  return (
    <button
      className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-slate-300 hover:bg-slate-50"
      onClick={() => onExpand(event)}
      title="展开这次工具调用"
      type="button"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="shrink-0 text-slate-500" size={15} aria-hidden="true" />
        <span className="truncate font-medium text-slate-800">{toolName || "tool"}</span>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500">
        <Maximize2 size={12} aria-hidden="true" />
        {formatDateTime(event.created_at)}
      </span>
    </button>
  );
}

function ToolArguments({ value }: { value: unknown }) {
  return (
    <div className="mt-3 break-all">
      <div className="mb-1 text-xs font-medium text-slate-500">调用参数</div>
      <pre className="overflow-auto rounded-md bg-white p-2 text-[11px] leading-5 text-slate-600">
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

function McpResultPreview({ result }: { result: McpToolResultPayload }) {
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-xs font-medium text-slate-500">MCP 工具结果</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">
          {result.server_name}.{result.tool_name}
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">MCP 参数</div>
          <pre className="max-h-28 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] leading-5 text-slate-600">
            {JSON.stringify(result.arguments, null, 2)}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">MCP 返回内容</div>
          <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] leading-5 whitespace-pre-wrap text-slate-700">
            {JSON.stringify(result.content, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function A2aResultPreview({ result }: { result: A2aTaskResultPayload }) {
  // 这个组件只负责展示 A2A 工具结果。
  // 数据已经在 parseA2aTaskResult 中做过结构检查，所以这里可以直接渲染。
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-xs font-medium text-slate-500">A2A 远程 Agent</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">{result.remote_agent}</div>
        <div className="mt-1 text-xs text-slate-500">
          {result.agent_key} · {result.task_id} · {result.status}
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">远程输出</div>
          <div className="rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-700">
            {result.output_message.map((part) => part.text).join("\n") || "暂无输出"}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">协作步骤</div>
          <div className="grid gap-2">
            {result.steps.map((step) => (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                key={`${step.index}-${step.action}`}
              >
                <div className="text-xs font-semibold text-slate-900">
                  {step.index}. {step.action}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiAgentResultPreview({ result }: { result: MultiAgentResultPayload }) {
  // 这个组件展示 Manager / Worker / Reviewer 的协作结果。
  // 数据已经经过 parseMultiAgentResult 检查，因此这里只负责布局。
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="text-xs font-medium text-slate-500">多 Agent 协作</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">{result.manager}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{result.task}</p>
      </div>
      <div className="grid gap-3 p-3">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-500">子任务分派</div>
          <div className="grid gap-2">
            {result.subtasks.map((subtask) => (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                key={subtask.id}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900">{subtask.title}</span>
                  <span className="text-slate-500">{subtask.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{subtask.assignee}</p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{subtask.output}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="text-xs font-semibold text-emerald-800">
            {result.review.reviewer} · {result.review.status}
          </div>
          <ul className="mt-1 list-inside list-disc text-xs leading-5 text-emerald-700">
            {result.review.comments.map((comment) => (
              <li key={comment}>{comment}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs leading-5 text-emerald-700">{result.review.improvement}</p>
        </div>
        <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs leading-5 whitespace-pre-wrap text-slate-700">
          {result.final_answer}
        </pre>
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
  mcpResult: McpToolResultPayload | null,
  a2aResult: A2aTaskResultPayload | null,
  multiAgentResult: MultiAgentResultPayload | null,
) {
  if (screenshot) {
    return Camera;
  }
  if (searchResults || toolName.startsWith("search_")) {
    return Search;
  }
  if (mcpResult || toolName.startsWith("mcp_")) {
    return Plug;
  }
  if (a2aResult || toolName.startsWith("a2a_")) {
    return Network;
  }
  if (multiAgentResult || toolName.startsWith("multi_agent_")) {
    return GitBranch;
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
          title: parseString(item.title),
          url: parseString(item.url),
          snippet: parseString(item.snippet),
        })),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseMcpToolResult(value: string): McpToolResultPayload | null {
  try {
    // McpAgentTool 的 output 是 JSON 字符串。
    // 只有 kind=mcp_tool_result 时，才按 MCP 工具卡片渲染。
    const payload = JSON.parse(value) as Partial<McpToolResultPayload>;
    if (
      payload.kind === "mcp_tool_result" &&
      typeof payload.server_name === "string" &&
      typeof payload.tool_name === "string" &&
      payload.arguments &&
      typeof payload.arguments === "object" &&
      Array.isArray(payload.content)
    ) {
      return {
        kind: "mcp_tool_result",
        server_name: payload.server_name,
        tool_name: payload.tool_name,
        arguments: payload.arguments as Record<string, unknown>,
        content: payload.content.map((item) =>
          item && typeof item === "object" ? item : { value: item },
        ),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseA2aTaskResult(value: string): A2aTaskResultPayload | null {
  try {
    // 1. A2aAgentTool 的 output 是 JSON 字符串。
    //    如果不是 JSON，说明它不是 A2A 结构化结果，直接返回 null。
    const payload = JSON.parse(value) as Partial<A2aTaskResultPayload>;

    // 2. kind 是工具结果协议的分流字段。
    //    只有 kind=a2a_task_result 时，才按远程 Agent 协作结果卡片渲染。
    if (
      payload.kind === "a2a_task_result" &&
      typeof payload.agent_key === "string" &&
      typeof payload.remote_agent === "string" &&
      typeof payload.task_id === "string" &&
      typeof payload.status === "string" &&
      Array.isArray(payload.input_message) &&
      Array.isArray(payload.output_message) &&
      Array.isArray(payload.steps)
    ) {
      // 3. 做一次轻量归一化。
      //    后端返回的数组元素即使缺字段，前端也尽量用空字符串兜底。
      return {
        kind: "a2a_task_result",
        agent_key: payload.agent_key,
        remote_agent: payload.remote_agent,
        task_id: payload.task_id,
        status: payload.status,
        input_message: payload.input_message.map((item) => ({
          kind: parseString(item.kind),
          text: parseString(item.text),
        })),
        output_message: payload.output_message.map((item) => ({
          kind: parseString(item.kind),
          text: parseString(item.text),
        })),
        steps: payload.steps.map((item, index) => ({
          index: typeof item.index === "number" ? item.index : index + 1,
          action: parseString(item.action),
          detail: parseString(item.detail),
        })),
      };
    }
  } catch {
    // 4. 解析失败不是页面错误。
    //    其他工具的普通文本输出也会走到这里，所以静默返回 null。
    return null;
  }
  return null;
}

function parseMultiAgentResult(value: string): MultiAgentResultPayload | null {
  try {
    // 1. MultiAgentTool 的 output 也是 JSON 字符串。
    //    kind 字段用来区分它和截图、搜索、MCP、A2A 等其他工具结果。
    const payload = JSON.parse(value) as Partial<MultiAgentResultPayload>;

    // 2. 做最小结构检查。
    //    只在关键字段存在时进入多 Agent 专用卡片，避免普通文本被误判。
    if (
      payload.kind === "multi_agent_result" &&
      typeof payload.task === "string" &&
      typeof payload.manager === "string" &&
      Array.isArray(payload.roles) &&
      Array.isArray(payload.subtasks) &&
      payload.review &&
      typeof payload.review === "object" &&
      typeof payload.final_answer === "string"
    ) {
      const review = payload.review as Partial<MultiAgentResultPayload["review"]>;

      // 3. 归一化数组元素。
      //    后端字段如果以后扩展，前端仍然只读取当前需要展示的字段。
      return {
        kind: "multi_agent_result",
        task: payload.task,
        manager: payload.manager,
        roles: payload.roles.map((item) => ({
          key: parseString(item.key),
          name: parseString(item.name),
          responsibility: parseString(item.responsibility),
          capability: parseString(item.capability),
        })),
        subtasks: payload.subtasks.map((item) => ({
          id: parseString(item.id),
          assignee: parseString(item.assignee),
          title: parseString(item.title),
          instruction: parseString(item.instruction),
          expected_output: parseString(item.expected_output),
          status: parseString(item.status),
          output: parseString(item.output),
        })),
        review: {
          reviewer: parseString(review.reviewer),
          status: parseString(review.status),
          comments: Array.isArray(review.comments)
            ? review.comments.map((comment) => parseString(comment))
            : [],
          improvement: parseString(review.improvement),
        },
        final_answer: payload.final_answer,
      };
    }
  } catch {
    // 4. 不是 JSON 或不是多 Agent 结构时，交给普通文本预览。
    return null;
  }
  return null;
}
