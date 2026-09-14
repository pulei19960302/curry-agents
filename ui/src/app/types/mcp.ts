export type McpServerItem = {
  name: string; // MCP Server 配置名。
  enabled: boolean; // 是否启用。
  transport: string; // demo、stdio、sse 或 streamable_http。
  description: string; // 配置说明。
};

export type McpServerListData = {
  items: McpServerItem[];
};

export type McpToolItem = {
  server_name: string; // 工具来自哪个 MCP Server。
  name: string; // MCP 工具名。
  description: string; // 工具说明。
  input_schema: Record<string, unknown>; // MCP tools/list 返回的参数 JSON Schema。
};

export type McpToolListData = {
  items: McpToolItem[];
};
