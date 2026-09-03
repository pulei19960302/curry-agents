import { BrainCircuit, FileText } from "lucide-react";

import { formatBytes, formatDateTime } from "@/lib/format";
import type { LoadState, SessionContextData } from "@/types/sessions";

type ContextPanelProps = {
  context: LoadState<SessionContextData | null>;
  onRefresh: () => void;
  disabled: boolean;
};

export default function ContextPanel({ context, disabled, onRefresh }: ContextPanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <BrainCircuit size={17} aria-hidden="true" />
            上下文工程
          </h2>
          <p className="mt-1 text-sm text-slate-500">查看 Agent 继续执行时会带入的压缩上下文</p>
        </div>
        <button
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          disabled={disabled}
          onClick={onRefresh}
          type="button"
        >
          刷新
        </button>
      </div>

      <div className="mt-4">
        {context.type === "loading" ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">上下文加载中</p>
        ) : context.type === "error" ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-rose-600">
            {context.message}
          </p>
        ) : context.data ? (
          <ContextSnapshot snapshot={context.data} />
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
            选择会话后可以查看上下文快照
          </p>
        )}
      </div>
    </section>
  );
}

function ContextSnapshot({ snapshot }: { snapshot: SessionContextData }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
        {snapshot.summary}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <Metric label="纳入消息" value={snapshot.budget.included_messages} />
        <Metric label="省略消息" value={snapshot.budget.omitted_messages} />
        <Metric label="纳入事件" value={snapshot.budget.included_events} />
        <Metric label="省略事件" value={snapshot.budget.omitted_events} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">最近消息</h3>
        <div className="mt-2 space-y-2">
          {snapshot.messages.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">暂无消息</p>
          ) : (
            snapshot.messages.map((message, index) => (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
                key={`${message.created_at}-${index}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{message.role}</span>
                  <span>{formatDateTime(message.created_at)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-700">
                  {message.content}
                </p>
                {message.truncated ? (
                  <p className="mt-2 text-xs text-amber-700">
                    原始长度 {message.original_chars} 字符，已按预算裁剪
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">事件摘要</h3>
        <div className="mt-2 grid gap-2">
          {snapshot.event_summaries.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">暂无事件</p>
          ) : (
            snapshot.event_summaries.map((event) => (
              <div
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                key={event.type}
              >
                <span className="font-medium text-slate-800">{event.type}</span>
                <span className="text-xs text-slate-500">{event.count} 次</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">文件引用</h3>
        <div className="mt-2 space-y-2">
          {snapshot.files.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">暂无文件引用</p>
          ) : (
            snapshot.files.map((file) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={file.id}>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 text-slate-500" size={16} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {file.content_type} · {formatBytes(file.size)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{file.usage_hint}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-950">{value}</div>
    </div>
  );
}
