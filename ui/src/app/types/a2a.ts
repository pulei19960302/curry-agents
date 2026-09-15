export type A2aRoleItem = {
  name: string;
  responsibility: string;
  curry_agent_mapping: string;
};

export type A2aConceptsData = {
  roles: A2aRoleItem[];
  protocol: string;
  next_step: string;
};

export type A2aCapabilityItem = {
  name: string;
  description: string;
  example: string;
};

export type A2aAgentCardData = {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: A2aCapabilityItem[];
  default_input_modes: string[];
  default_output_modes: string[];
};
