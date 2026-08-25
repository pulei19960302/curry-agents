import { Download } from "lucide-react";

import { formatBytes, formatDateTime } from "@/lib/format";
import { getDownloadUrl } from "@/lib/files-api";
import type { UploadedFile } from "@/types/files";

type AttachmentListProps = {
  files: UploadedFile[];
};

export default function AttachmentList({ files }: AttachmentListProps) {
  if (files.length === 0) {
    return (
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
        还没有上传附件
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <a
          className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-slate-300"
          href={getDownloadUrl(file)}
          key={file.id}
        >
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">
              {file.original_name}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {formatBytes(file.size)} · {formatDateTime(file.created_at)}
            </span>
          </span>
          <Download className="shrink-0 text-slate-500" size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}