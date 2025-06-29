import { EventEmitter } from 'eventemitter3';
import type { AgentConfig, Message, Tool, AgentMemory } from '../types';

export class Agent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string;
  private config: AgentConfig;
  private memory: AgentMemory;
  private tools: Map<string, Tool> = new Map();

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.config = config;
    this.memory = {
      conversations: [],
      facts: {}
    };
  }

  async sendMessage(content: string): Promise<Message> {
    // Placeholder for WebLLM integration
    const message: Message = {
      id: crypto.randomUUID(),
      agentId: this.id,
      content,
      timestamp: new Date(),
      type: 'assistant'
    };

    this.memory.conversations.push(message);
    this.emit('message', message);
    
    return message;
  }

  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getMemory(): AgentMemory {
    return this.memory;
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configUpdated', this.config);
  }
}