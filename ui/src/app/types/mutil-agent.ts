export type MultiAgentRoleItem = {
  key: string; // 程序识别角色的稳定标识，例如 manager。
  name: string; // 展示给用户看的角色名称。
  responsibility: string; // 角色在协作流程中负责什么。
  capability: string; // 角色擅长处理的任务类型。
};

export type MultiAgentRoleListData = {
  items: MultiAgentRoleItem[];
};
