export type SettingsIntegrationKind = "llm" | "mcp" | "a2a" | "multi_agent";

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
  key: "llm" | "mcp" | "a2a" | "multi_agent";
  name: string; // 模块展示名称。
  description: string; // 模块说明。
  enabled: boolean; // 设置页中的运行时启用状态。
  default_item: string | null; // 当前默认项。
  items: SettingsItem[]; // 模块下的配置项列表。
};

export type AppSettingsData = {
  modules: SettingsModule[];
  integrations: SettingsIntegration[];
};
