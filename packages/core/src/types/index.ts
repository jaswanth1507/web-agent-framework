export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
}

export interface Message {
  id: string;
  agentId: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export interface WorkflowStep {
  id: string;
  agentId: string;
  action: string;
  parameters: Record<string, any>;
  dependencies?: string[];
}

export interface AgentMemory {
  conversations: Message[];
  facts: Record<string, any>;
  embeddings?: Float32Array[];
}