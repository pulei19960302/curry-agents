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
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-500">
        选择文件后可以查看文本预览
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#08090d] shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-medium tracking-[0.18em] text-zinc-600 uppercase">
            File Preview
          </div>
          <h3 className="truncate text-sm font-semibold text-zinc-50">
            {selectedFile.file.original_name}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">文本文件会显示预览内容，必要时可展开查看</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-50"
            onClick={() => onPreview(selectedFile.file.id)}
            title="查看预览"
            type="button"
          >
            <FileText size={16} aria-hidden="true" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={preview.type !== "ready" || !preview.data}
            onClick={() => setExpanded(true)}
            title="展开预览"
            type="button"
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
          {onClose ? (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-50"
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
          <p className="text-sm text-zinc-500">预览加载中</p>
        ) : preview.type === "error" ? (
          <p className="text-sm text-rose-300">{preview.message}</p>
        ) : preview.data ? (
          <pre className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 break-words whitespace-pre-wrap text-zinc-200">
            {preview.data.content}
            {preview.data.truncated ? "\n\n预览已裁剪，可在文件服务中查看完整内容。" : ""}
          </pre>
        ) : (
          <p className="text-sm text-zinc-500">点击右上角按钮加载预览</p>
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
    <div className="fixed inset-0 z-50 bg-black/70 p-6 backdrop-blur-sm max-sm:p-3">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#08090d] shadow-2xl shadow-black">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-50">{name}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {truncated ? "当前显示裁剪预览。" : "完整预览内容"}
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-zinc-50"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-black/20 p-5">
          <pre className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 break-words whitespace-pre-wrap text-zinc-200">
            {content}
            {truncated ? "\n\n预览已裁剪，可在文件服务中查看完整内容。" : ""}
          </pre>
        </div>
      </div>
    </div>
  );
}
