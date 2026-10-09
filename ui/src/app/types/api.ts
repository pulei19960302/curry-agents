// 统一接口返回的数据类型
export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T | null;
  error?: ApiErrorData | null;
};

// /api/status 接口返回的数据类型
export type ApiStatusData = {
  service: string;
  environment: string;
  status: string;
  version: string;
};

export type DatabaseStatusData = {
  status: string;
};

export type ApiErrorData = {
  type: string;
  source: string;
  user_message: string;
  suggestion: string;
  request_id: string | null;
  details: Record<string, unknown> | null;
};
