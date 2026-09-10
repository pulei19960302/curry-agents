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

  return (
    <div className="mt-2 grid gap-2 text-xs text-slate-600">
      <div>
        <span className="font-medium text-slate-700">工具：</span>
        {toolName || "-"}
      </div>
    </div>
  );
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
