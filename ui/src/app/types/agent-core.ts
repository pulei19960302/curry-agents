export type ToolParameter = {
  name: string;
  type: string;
  description: string;
  required: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameter[];
};

export type ToolListData = {
  items: ToolDefinition[];
};

export type MemoryMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
  name: string | null;
};

export type ToolCallResult = {
  tool_name: string;
  arguments: Record<string, unknown>;
  output: string;
};

export type AgentCoreDemoData = {
  messages: MemoryMessage[];
  selected_tool: ToolDefinition;
  tool_result: ToolCallResult;
  next_step: string;
};
