// 统一接口返回的数据类型
export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T | null;
  error?: string | null;
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