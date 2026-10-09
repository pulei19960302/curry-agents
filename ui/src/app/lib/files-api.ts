import type { FilePreviewData, UploadedFile } from "@/types/files";
import type { ApiResponse } from "@/types/api";
import { ApiRequestError, requestApi } from "./api";

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
    const message = payload.error?.user_message || payload.message || `HTTP ${response.status}`;
    throw new ApiRequestError(message, payload.code, response.status, payload.error ?? null);
  }
  if (!payload.data) {
    throw new Error("empty response");
  }
  return payload.data;
}

export function getDownloadUrl(file: UploadedFile): string {
  return file.download_url;
}

export function fetchFilePreview(fileId: string): Promise<FilePreviewData> {
  return requestApi<FilePreviewData>(`/api/files/${fileId}/preview`);
}
