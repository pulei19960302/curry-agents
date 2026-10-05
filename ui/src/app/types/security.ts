export type SecurityCheckItem = {
  key: string;
  name: string;
  category: string; // configuration、uploads、sandbox、integrations、memory。
  severity: "info" | "warning" | "risk"; // 风险等级，用于决定前端徽标颜色。
  risk: string; // 不处理这条边界会带来什么风险。
  recommendation: string; // 推荐的配置、架构或上线前处理方式。
  verify_command: string; // 可复制执行的验证命令。
};

export type SecurityCheckListData = {
  items: SecurityCheckItem[];
};
