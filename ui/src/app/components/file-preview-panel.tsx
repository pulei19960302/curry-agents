import { FileText } from "lucide-react";

import type { LoadState, SessionFileItem } from "@/types/sessions";
import type { FilePreviewData } from "@/types/files";

type FilePreviewPanelProps = {
  onPreview: (fileId: string) => void;
  preview: LoadState<FilePreviewData | null>;
  selectedFile: SessionFileItem | null;
};

export function FilePreviewPanel({
  onPreview,
  preview,
  selectedFile,
}: FilePreviewPanelProps) {
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
          <p className="mt-1 text-xs text-slate-500">
            文本文件会显示前 64KB 内容
          </p>
        </div>
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-slate-300"
          onClick={() => onPreview(selectedFile.file.id)}
          title="查看预览"
          type="button"
        >
          <FileText size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-72 overflow-auto p-4">
        {preview.type === "loading" ? (
          <p className="text-sm text-slate-500">预览加载中</p>
        ) : preview.type === "error" ? (
          <p className="text-sm text-rose-600">{preview.message}</p>
        ) : preview.data ? (
          <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
            {preview.data.content}
            {preview.data.truncated ? "\n\n内容较长，已截断显示。" : ""}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">点击右上角按钮加载预览</p>
        )}
      </div>
    </div>
  );
}
