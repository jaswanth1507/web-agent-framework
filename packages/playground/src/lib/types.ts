// Type definitions for the playground

export interface InitProgressReport {
  progress: number;
  timeElapsed: number;
  text: string;
}

export interface MLCEngineInterface {
  chat: any;
  reload: (model: string) => Promise<void>;
}

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  tools?: any[];
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: any[];
  toolCallId?: string;
}