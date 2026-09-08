import { Activity } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { LoadState, SessionEventItem } from "@/types/sessions";

export default function EventTimeline({ state }: { state: LoadState<SessionEventItem[]> }) {
  if (state.type === "loading") {
    return <div className="text-sm text-slate-500">事件加载中...</div>;
  }

  if (state.type === "error") {
    return <div className="text-sm text-rose-600">{state.message}</div>;
  }

  if (state.data.length === 0) {
    return <div className="text-sm text-slate-500">暂无事件</div>;
  }

  return (
    <div className="grid gap-2">
      {state.data.map((event) => (
        <div
          className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          key={event.id}
        >
          <Activity className="mt-0.5 shrink-0 text-slate-500" size={15} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800">{event.type}</div>
            <div className="mt-1 text-xs text-slate-500">{formatDate(event.created_at)}</div>
            <EventPayload event={event} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EventPayload({ event }: { event: SessionEventItem }) {
  if (event.type !== "tool_called") {
    return null;
  }

  const toolName = getString(event.payload.tool_name);
  const output = getString(event.payload.output);
  const screenshot = parseScreenshot(output);

  return (
    <div className="mt-2 grid gap-2 text-xs text-slate-600">
      <div>
        <span className="font-medium text-slate-700">工具：</span>
        {toolName || "-"}
      </div>
      <pre className="max-h-24 overflow-auto rounded-md bg-white p-2 text-[11px] leading-5 text-slate-600">
        {JSON.stringify(event.payload.arguments ?? {}, null, 2)}
      </pre>
      {screenshot ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <img
            alt="浏览器截图"
            className="max-h-48 w-full object-contain"
            src={`data:${screenshot.mime_type};base64,${screenshot.base64_data}`}
          />
          <div className="border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
            {screenshot.mime_type} · {screenshot.size} bytes
          </div>
        </div>
      ) : (
        <pre className="max-h-32 overflow-auto rounded-md bg-white p-2 text-[11px] leading-5 whitespace-pre-wrap text-slate-600">
          {output || "<no output>"}
        </pre>
      )}
    </div>
  );
}

type ScreenshotPayload = {
  kind: "browser_screenshot";
  mime_type: string;
  base64_data: string;
  size: number;
};

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

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
