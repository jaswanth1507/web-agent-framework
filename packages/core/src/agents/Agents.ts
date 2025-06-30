// packages/core/src/agents/Agent.ts
import { EventEmitter } from 'eventemitter3';
import type { 
  MLCEngineInterface, 
  ChatCompletionRequest, 
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam
} from '@mlc-ai/web-llm';

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt?: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  tools?: AgentTool[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  handler: (args: any) => Promise<any>;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentState {
  config: AgentConfig;
  messages: ChatMessage[];
  isLoaded: boolean;
  isStreaming: boolean;
  lastActivity: number;
}

export class Agent extends EventEmitter {
  private config: AgentConfig;
  private engine: MLCEngineInterface | null = null;
  private messages: ChatMessage[] = [];
  private isLoaded = false;
  private isStreaming = false;
  private tools = new Map<string, AgentTool>();

  constructor(config: AgentConfig) {
    super();
    this.config = { ...config };
    
    // Register tools if provided
    if (config.tools) {
      config.tools.forEach(tool => this.registerTool(tool));
    }

    // Add system message if provided
    if (config.systemPrompt) {
      this.messages.push({
        id: this.generateId(),
        role: 'system',
        content: config.systemPrompt,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Initialize the agent with a WebLLM engine instance
   */
  async initialize(engine: MLCEngineInterface): Promise<void> {
    try {
      this.engine = engine;
      
      // Load the model
      this.emit('model-loading', { model: this.config.model });
      await engine.reload(this.config.model);
      
      this.isLoaded = true;
      this.emit('initialized', { agentId: this.config.id });
    } catch (error) {
      this.emit('error', { error, agentId: this.config.id });
      throw error;
    }
  }

  /**
   * Send a message and get a response from the agent
   */
  async chat(message: string, streaming = true): Promise<string> {
    if (!this.engine || !this.isLoaded) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    if (this.isStreaming) {
      throw new Error('Agent is currently processing another request.');
    }

    try {
      this.isStreaming = true;
      
      // Add user message
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      this.messages.push(userMessage);
      this.emit('message-added', { message: userMessage });

      // Prepare chat completion request
      const request: ChatCompletionRequest = {
        messages: this.messages.map(msg => {
          const baseMessage: any = {
            role: msg.role,
            content: msg.content
          };
          if (msg.role === 'tool' && msg.toolCallId) {
            baseMessage.tool_call_id = msg.toolCallId;
          }
          return baseMessage as ChatCompletionMessageParam;
        }),
        temperature: this.config.temperature || 0.7,
        top_p: this.config.topP || 0.9,
        max_tokens: this.config.maxTokens || 1000,
        stream: streaming
      };

      // Add tools if available
      if (this.tools.size > 0) {
        request.tools = Array.from(this.tools.values()).map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters || {}
          }
        }));
        request.tool_choice = 'auto';
      }

      let responseContent = '';
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      if (streaming) {
        this.emit('streaming-start', { agentId: this.config.id });
        
        const stream = await this.engine.chat.completions.create(request);
        
        // Handle streaming response
        const streamResponse = stream as AsyncIterable<ChatCompletionChunk>;
        for await (const chunk of streamResponse) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            responseContent += delta.content;
            assistantMessage.content = responseContent;
            this.emit('streaming-chunk', { 
              chunk: delta.content, 
              message: assistantMessage 
            });
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            assistantMessage.toolCalls = delta.tool_calls.map((tc: any) => ({
              id: tc.id || '',
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || ''
            }));
          }
        }
        
        this.emit('streaming-end', { agentId: this.config.id });
      } else {
        const response = await this.engine.chat.completions.create(request) as ChatCompletion;
        responseContent = response.choices[0]?.message?.content || '';
        assistantMessage.content = responseContent;

        // Handle tool calls
        if (response.choices[0]?.message?.tool_calls) {
          assistantMessage.toolCalls = response.choices[0].message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments
          }));
        }
      }

      // Process tool calls if present
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        this.messages.push(assistantMessage);
        this.emit('message-added', { message: assistantMessage });
        
        // Execute tools and continue conversation
        await this.executeToolCalls(assistantMessage.toolCalls);
        return await this.chat('', streaming); // Continue conversation after tool execution
      }

      this.messages.push(assistantMessage);
      this.emit('message-added', { message: assistantMessage });
      
      return responseContent;
    } catch (error) {
      this.emit('error', { error, agentId: this.config.id });
      throw error;
    } finally {
      this.isStreaming = false;
    }
  }

  /**
   * Execute tool calls and add results to conversation
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.name);
      if (!tool) {
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: 'tool',
          content: `Error: Tool '${toolCall.name}' not found`,
          timestamp: Date.now(),
          toolCallId: toolCall.id
        };
        this.messages.push(errorMessage);
        continue;
      }

      try {
        const args = JSON.parse(toolCall.arguments);
        const result = await tool.handler(args);
        
        const toolMessage: ChatMessage = {
          id: this.generateId(),
          role: 'tool',
          content: JSON.stringify(result),
          timestamp: Date.now(),
          toolCallId: toolCall.id
        };
        
        this.messages.push(toolMessage);
        this.emit('tool-executed', { toolCall, result });
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: this.generateId(),
          role: 'tool',
          content: `Error executing tool: ${error}`,
          timestamp: Date.now(),
          toolCallId: toolCall.id
        };
        this.messages.push(errorMessage);
        this.emit('tool-error', { toolCall, error });
      }
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    this.emit('tool-registered', { tool });
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    if (this.tools.delete(name)) {
      this.emit('tool-unregistered', { name });
    }
  }

  /**
   * Update agent configuration
   */
  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', { config: this.config });
  }

  /**
   * Clear conversation history (keeping system message)
   */
  clearHistory(): void {
    const systemMessages = this.messages.filter(msg => msg.role === 'system');
    this.messages = systemMessages;
    this.emit('history-cleared', { agentId: this.config.id });
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return {
      config: { ...this.config },
      messages: [...this.messages],
      isLoaded: this.isLoaded,
      isStreaming: this.isStreaming,
      lastActivity: this.messages.length > 0 ? 
        Math.max(...this.messages.map(m => m.timestamp)) : 0
    };
  }

  /**
   * Restore agent state
   */
  restoreState(state: AgentState): void {
    this.config = { ...state.config };
    this.messages = [...state.messages];
    this.isLoaded = state.isLoaded;
    this.emit('state-restored', { agentId: this.config.id });
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get conversation messages
   */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /**
   * Check if agent is ready to chat
   */
  isReady(): boolean {
    return this.isLoaded && !this.isStreaming;
  }

  /**
   * Destroy the agent and clean up resources
   */
  destroy(): void {
    this.removeAllListeners();
    this.engine = null;
    this.isLoaded = false;
    this.emit('destroyed', { agentId: this.config.id });
  }
}