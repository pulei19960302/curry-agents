import type { UploadedFile, FilePreviewData } from "@/types/files";
import type { ApiResponse } from "@/types/api";

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("upload", file);

  /**
   * 这里没有手动设置 Content-Type。

原因是 FormData 请求需要浏览器自动生成边界。如果手动写成 multipart/form-data，边界可能缺失，后端会解析失败。
   */

  const response = await fetch("/api/files/upload_file", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as ApiResponse<UploadedFile>;
  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  if (!payload.data) {
    throw new Error("empty response");
  }
  return payload.data;
}

export function getDownloadUrl(file: UploadedFile): string {
  return file.download_url;
}

import { requestApi } from "./api";

export function fetchFilePreview(fileId: string): Promise<FilePreviewData> {
  return requestApi<FilePreviewData>(`/api/files/${fileId}/preview`);
}
