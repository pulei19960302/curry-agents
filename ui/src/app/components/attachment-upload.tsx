import { Paperclip, Upload } from "lucide-react";

type AttachmentUploadProps = {
  disabled: boolean;
  onUpload: (file: File) => void;
  uploading: boolean;
};

export default function AttachmentUpload({
  disabled,
  onUpload,
  uploading,
}: AttachmentUploadProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed">
      <span className="flex min-w-0 items-center gap-2">
        <Paperclip size={16} aria-hidden="true" />
        <span className="truncate">
          {uploading ? "附件上传中" : "选择附件上传"}
        </span>
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
        <Upload size={15} aria-hidden="true" />
      </span>
      <input
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onUpload(file);
          }
          event.target.value = "";
        }}
        type="file"
      />
    </label>
  );
}
