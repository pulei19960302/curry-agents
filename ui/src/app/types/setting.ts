export type SettingsIntegrationKind = "llm" | "search" | "mcp" | "a2a" | "multi_agent" | "sandbox";

export type SettingsIntegration = {
  id: string;
  kind: SettingsIntegrationKind;
  name: string;
  description: string;
  endpoint: string | null;
  enabled: boolean;
};

export type SettingsItem = {
  name: string;
  description: string;
  enabled: boolean;
  metadata: Record<string, object>;
};

export type SettingsModule = {
  key: SettingsIntegrationKind;
  name: string; // 模块展示名称。
  description: string; // 模块说明。
  enabled: boolean; // 设置页中的运行时启用状态。
  default_item: string | null; // 当前默认项。
  items: SettingsItem[]; // 模块下的配置项列表。
  status: "ready" | "warning" | "disabled" | string;
  status_message: string;
  source: string;
  verify_command: string;
};

export type AppSettingsData = {
  modules: SettingsModule[];
  integrations: SettingsIntegration[];
};
