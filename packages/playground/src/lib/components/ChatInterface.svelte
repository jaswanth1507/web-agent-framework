<!-- packages/playground/src/lib/components/ChatInterface.svelte -->
<script>
  import { onMount } from 'svelte';
  // @ts-ignore
  import { CreateMLCEngine } from '@mlc-ai/web-llm';
  // @ts-ignore  
  import { Agent } from '@web-agent/core';
  
  // Helper function to avoid inline type annotation
  function getToolCallNames(toolCalls) {
    return toolCalls.map(tc => tc.name).join(', ');
  }

  // Component state
  let engine = null;
  let agent = null;
  let messages = [];
  let inputValue = '';
  let isLoading = false;
  let isStreaming = false;
  let loadingStatus = '';
  let errorMessage = '';

  // Available models (common MLC models)
  const availableModels = [
    'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    'Phi-3.5-mini-instruct-q4f16_1-MLC',
    'gemma-2-2b-it-q4f16_1-MLC'
  ];

  // Agent configuration
  let agentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    model: availableModels[0],
    systemPrompt: 'You are a helpful AI assistant. Be concise and friendly.',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1000
  };

  // Initialize WebLLM and Agent
  async function initializeAgent() {
    try {
      isLoading = true;
      errorMessage = '';
      loadingStatus = 'Initializing WebLLM engine...';

      // Create WebLLM engine
      engine = await CreateMLCEngine(agentConfig.model, {
        initProgressCallback: (progress) => {
          loadingStatus = `Loading model: ${Math.round(progress.progress * 100)}%`;
        }
      });

      loadingStatus = 'Creating agent...';

      // Create agent
      agent = new Agent(agentConfig);

      // Set up event listeners
      setupAgentEventListeners();

      // Initialize agent with engine
      await agent.initialize(engine);

      loadingStatus = 'Ready!';
      messages = agent.getMessages();
      
    } catch (error) {
      console.error('Failed to initialize agent:', error);
      errorMessage = `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading = false;
    }
  }

  // Set up event listeners for agent
  function setupAgentEventListeners() {
    if (!agent) return;

    agent.on('message-added', () => {
      messages = agent.getMessages();
    });

    agent.on('streaming-start', () => {
      isStreaming = true;
    });

    agent.on('streaming-chunk', () => {
      messages = agent.getMessages();
    });

    agent.on('streaming-end', () => {
      isStreaming = false;
    });

    agent.on('error', ({ error }) => {
      console.error('Agent error:', error);
      errorMessage = `Agent error: ${error.message}`;
      isStreaming = false;
    });

    agent.on('tool-executed', ({ toolCall, result }) => {
      console.log('Tool executed:', toolCall.name, result);
    });
  }

  // Send message
  async function sendMessage() {
    if (!agent || !inputValue.trim() || isStreaming) return;

    const messageText = inputValue.trim();
    inputValue = '';
    errorMessage = '';

    try {
      await agent.chat(messageText, true); // Enable streaming
    } catch (error) {
      console.error('Error sending message:', error);
      errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Handle Enter key
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  // Clear chat history
  function clearChat() {
    if (agent) {
      agent.clearHistory();
      messages = agent.getMessages();
    }
  }

  // Update agent configuration
  function updateAgentConfig() {
    if (agent) {
      agent.updateConfig(agentConfig);
    }
  }

  // Auto-scroll to bottom
  let messagesContainer;
  $: if (messagesContainer && messages.length > 0) {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 10);
  }

  onMount(() => {
    // Check WebGPU support
    if (!navigator.gpu) {
      errorMessage = 'WebGPU not supported in this browser. Please use Chrome 113+ or Edge 113+';
      return;
    }
  });
</script>

<div class="flex flex-col h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white border-b border-gray-200 p-4">
    <h1 class="text-xl font-semibold text-gray-900">WebLLM Agent Framework - Chat Test</h1>
    <p class="text-sm text-gray-600">Testing the core Agent class with WebLLM integration</p>
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar - Configuration -->
    <div class="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h2 class="font-medium text-gray-900 mb-4">Agent Configuration</h2>
      
      <!-- Model Selection -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Model</label>
        <select bind:value={agentConfig.model} class="w-full p-2 border border-gray-300 rounded-md">
          {#each availableModels as model}
            <option value={model}>{model}</option>
          {/each}
        </select>
      </div>

      <!-- Agent Name -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
        <input 
          type="text" 
          bind:value={agentConfig.name} 
          class="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <!-- System Prompt -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
        <textarea 
          bind:value={agentConfig.systemPrompt} 
          rows="3"
          class="w-full p-2 border border-gray-300 rounded-md"
        ></textarea>
      </div>

      <!-- Parameters -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Temperature: {agentConfig.temperature}
        </label>
        <input 
          type="range" 
          min="0" 
          max="2" 
          step="0.1" 
          bind:value={agentConfig.temperature}
          class="w-full"
        />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Top P: {agentConfig.topP}
        </label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.1" 
          bind:value={agentConfig.topP}
          class="w-full"
        />
      </div>

      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
        <input 
          type="number" 
          bind:value={agentConfig.maxTokens} 
          min="1" 
          max="4000"
          class="w-full p-2 border border-gray-300 rounded-md"
        />
      </div>

      <!-- Actions -->
      <div class="space-y-2">
        <button 
          on:click={initializeAgent}
          disabled={isLoading}
          class="w-full bg-blue-600 text-white p-2 rounded-md disabled:bg-gray-400"
        >
          {isLoading ? 'Initializing...' : 'Initialize Agent'}
        </button>
        
        <button 
          on:click={updateAgentConfig}
          disabled={!agent}
          class="w-full bg-green-600 text-white p-2 rounded-md disabled:bg-gray-400"
        >
          Update Config
        </button>
        
        <button 
          on:click={clearChat}
          disabled={!agent}
          class="w-full bg-red-600 text-white p-2 rounded-md disabled:bg-gray-400"
        >
          Clear Chat
        </button>
      </div>

      <!-- Status -->
      {#if loadingStatus}
        <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p class="text-sm text-blue-800">{loadingStatus}</p>
        </div>
      {/if}

      {#if errorMessage}
        <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-800">{errorMessage}</p>
        </div>
      {/if}
    </div>

    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col">
      <!-- Messages -->
      <div 
        bind:this={messagesContainer}
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {#each messages as message (message.id)}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg {
              message.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : message.role === 'assistant'
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-yellow-100 text-yellow-800'
            }">
              <div class="text-xs font-medium mb-1 opacity-70">
                {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
              </div>
              <div class="whitespace-pre-wrap">{message.content}</div>
              {#if message.toolCalls && message.toolCalls.length > 0}
                <div class="mt-2 text-xs opacity-70">
                  Tool calls: {getToolCallNames(message.toolCalls)}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if isStreaming}
          <div class="flex justify-start">
            <div class="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
              <div class="text-xs font-medium mb-1 opacity-70">Assistant</div>
              <div class="animate-pulse">Thinking...</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Input Area -->
      <div class="border-t border-gray-200 p-4 bg-white">
        <div class="flex space-x-2">
          <input
            type="text"
            bind:value={inputValue}
            on:keydown={handleKeyDown}
            placeholder="Type your message..."
            disabled={!agent || isStreaming}
            class="flex-1 p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
          />
          <button
            on:click={sendMessage}
            disabled={!agent || !inputValue.trim() || isStreaming}
            class="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  /* Custom scrollbar for messages */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 6px;
  }
  
  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: #f1f1f1;
  }
  
  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background: #a1a1a1;
  }
</style>