export type UploadedFile = {
  id: string;
  original_name: string;
  content_type: string;
  size: number;
  download_url: string;
  created_at: string;
};

// 预览
export type FilePreviewData = {
  file: UploadedFile;
  content: string;
  file_type: string;
  language: string | null;
  line_count: number;
  parse_status: string;
  parse_message: string;
  references: Array<{
    label: string;
    excerpt: string;
    start_line: number | null;
    end_line: number | null;
  }>;
  summary: string;
  truncated: boolean;
};
