export type ObservabilityCheckItem = {
  key: string;
  name: string;
  category: string; // core、agent、tooling 等诊断分类。
  description: string; // 这条诊断项解决什么排查问题。
  command: string; // 可以直接复制执行的 curl 或命令。
  expected: string; // 正常情况下应该看到什么结果。
};

export type ObservabilityCheckListData = {
  items: ObservabilityCheckItem[];
};
