// 混入一些不知道放在哪里的类型定义

export type StreamEvent = {
  event: string;
  data: Record<string, unknown>;
};
