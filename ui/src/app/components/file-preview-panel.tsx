import { FileText, Maximize2, X } from "lucide-react";
import { useState } from "react";

import type { LoadState, SessionFileItem } from "@/types/sessions";
import type { FilePreviewData } from "@/types/files";

type FilePreviewPanelProps = {
  onClose?: () => void;
  onPreview: (fileId: string) => void;
  preview: LoadState<FilePreviewData | null>;
  selectedFile: SessionFileItem | null;
};

export default function FilePreviewPanel({
  onClose,
  onPreview,
  preview,
  selectedFile,
}: FilePreviewPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!selectedFile) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
        选择文件后可以查看文本预览
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {selectedFile.file.original_name}
          </h3>
          <p className="mt-1 text-xs text-slate-500">文本文件会显示前 64KB 内容</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-300"
            onClick={() => onPreview(selectedFile.file.id)}
            title="查看预览"
            type="button"
          >
            <FileText size={16} aria-hidden="true" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-300"
            disabled={preview.type !== "ready" || !preview.data}
            onClick={() => setExpanded(true)}
            title="展开预览"
            type="button"
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
          {onClose ? (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-300"
              onClick={onClose}
              title="关闭预览"
              type="button"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="max-h-72 overflow-auto p-4">
        {preview.type === "loading" ? (
          <p className="text-sm text-slate-500">预览加载中</p>
        ) : preview.type === "error" ? (
          <p className="text-sm text-rose-600">{preview.message}</p>
        ) : preview.data ? (
          <pre className="text-xs leading-5 wrap-break-word whitespace-pre-wrap text-slate-700">
            {preview.data.content}
            {preview.data.truncated ? "\n\n内容较长，已截断显示。" : ""}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">点击右上角按钮加载预览</p>
        )}
      </div>

      {expanded && preview.type === "ready" && preview.data ? (
        <FilePreviewDialog
          content={preview.data.content}
          name={selectedFile.file.original_name}
          onClose={() => setExpanded(false)}
          truncated={preview.data.truncated}
        />
      ) : null}
    </div>
  );
}

function FilePreviewDialog({
  content,
  name,
  onClose,
  truncated,
}: {
  content: string;
  name: string;
  onClose: () => void;
  truncated: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-6 max-sm:p-3">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-950">{name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {truncated ? "内容较长，当前显示已裁剪预览。" : "完整预览内容"}
            </p>
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
        <div className="flex-1 overflow-auto bg-slate-50 p-5">
          <pre className="rounded-md bg-white p-4 text-xs leading-5 break-words whitespace-pre-wrap text-slate-700">
            {content}
            {truncated ? "\n\n内容较长，已裁剪显示。" : ""}
          </pre>
        </div>
      </div>
    </div>
  );
}
