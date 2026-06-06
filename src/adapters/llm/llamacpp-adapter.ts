import type { ILLMAdapter, ContextInfo } from '../../core/interfaces/llm-adapter.js';
import type { HealthStatus, Message, ChatChunk } from '../../core/types.js';
import { resolvePath } from '../../config/loader.js';

export interface LlamaCppConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number | null;
}

/**
 * llama.cpp adapter using node-llama-cpp
 * Provides streaming chat with full control over inference parameters
 */
export class LlamaCppAdapter implements ILLMAdapter {
  readonly id = 'llamacpp';
  readonly name = 'llama.cpp';
  readonly version = '1.0.0';
  readonly capabilities = ['chat'];

  private model: unknown = null;
  private context: unknown = null;
  private config?: LlamaCppConfig;

  async init(config: LlamaCppConfig): Promise<void> {
    // Resolve path variables (e.g., $MODELS_STORE, ~)
    const resolvedPath = resolvePath(config.modelPath);
    this.config = { ...config, modelPath: resolvedPath };
    console.log(`[LlamaCppAdapter] Initialized with model: ${resolvedPath}`);
  }

  async destroy(): Promise<void> {
    // Clean up model resources
    this.context = null;
    this.model = null;
    this.config = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Adapter not initialized'
      };
    }

    try {
      const start = Date.now();
      // In production: ping model, measure latency
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async *chat(messages: Message[]): AsyncIterable<ChatChunk> {
    if (!this.context || !this.config) {
      throw new Error('Adapter not initialized');
    }

    const prompt = this.formatMessages(messages);
    
    // In production: stream from actual llama.cpp model
    // For now, yield mock response for testing
    yield* this.mockStream(prompt);
  }

  getContextInfo(): ContextInfo {
    if (!this.context) {
      return { size: 0, used: 0 };
    }
    return {
      size: this.config?.contextSize ?? 4096,
      used: 0 // Would track actual usage
    };
  }

  async unloadModel(): Promise<void> {
    await this.destroy();
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map(m => {
        const role = m.role === 'system' ? 'System' : m.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${m.content}`;
      })
      .join('\n\n') + '\n\nAssistant:';
  }

  private async *mockStream(prompt: string): AsyncIterable<ChatChunk> {
    // Mock response for testing - yields chunk by chunk
    const mockResponse = `Hello! I'm running locally with llama.cpp.`;
    const chunks = mockResponse.split(/(?=\s)/); // Split on word boundaries
    
    for (let i = 0; i < chunks.length; i++) {
      yield {
        content: chunks[i],
        done: i === chunks.length - 1
      };
      // Small delay to simulate streaming
      await new Promise(r => setTimeout(r, 10));
    }
  }
}