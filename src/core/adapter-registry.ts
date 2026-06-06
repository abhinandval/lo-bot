import type { IBaseAdapter, HealthStatus } from './types.js';
import type { ILLMAdapter } from './interfaces/llm-adapter.js';
import type { ITTSAdapter } from './interfaces/voice-adapters.js';
import type { IToolAdapter } from './interfaces/tool-adapters.js';
import type { CapabilityTier } from './capability-tracker.js';

export type AdapterType = 'llm' | 'stt' | 'tts' | 'browser' | 'websearch' | 'sandbox';

export interface AdapterConfig {
  type: AdapterType;
  id: string;
  enabled: boolean;
  tier: CapabilityTier;
  config: unknown;
}

/**
 * Central adapter registry.
 * Manages registration, lookup, and lifecycle of all adapters.
 */
export class AdapterRegistry {
  private adapters = new Map<string, IBaseAdapter>();
  private configs = new Map<string, AdapterConfig>();

  /**
   * Register an adapter with configuration
   */
  register(config: AdapterConfig, adapter: IBaseAdapter): void {
    if (adapter.id !== config.id) {
      throw new Error(
        `Adapter ID mismatch: config has "${config.id}" but adapter has "${adapter.id}"`
      );
    }
    this.adapters.set(config.id, adapter);
    this.configs.set(config.id, config);
  }

  /**
   * Get an adapter by ID
   */
  get(id: string): IBaseAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get config for an adapter
   */
  getConfig(id: string): AdapterConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get adapter by type (returns first enabled of that type)
   */
  getByType<T extends IBaseAdapter>(type: AdapterType): T | undefined {
    for (const [id, config] of this.configs) {
      if (config.type === type && config.enabled) {
        return this.adapters.get(id) as T | undefined;
      }
    }
    return undefined;
  }

  /**
   * Get all registered adapters
   */
  getAll(): IBaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all enabled adapters
   */
  getEnabled(): IBaseAdapter[] {
    const enabled: IBaseAdapter[] = [];
    for (const [id, config] of this.configs) {
      if (config.enabled && this.adapters.has(id)) {
        enabled.push(this.adapters.get(id)!);
      }
    }
    return enabled;
  }

  /**
   * Get LLM adapter (convenience method)
   */
  getLLM(): ILLMAdapter | undefined {
    return this.getByType<ILLMAdapter>('llm');
  }

  /**
   * Get TTS adapter (convenience method)
   */
  getTTS(): ITTSAdapter | undefined {
    return this.getByType<ITTSAdapter>('tts');
  }

  /**
   * Get all tool adapters
   */
  getTools(): IToolAdapter[] {
    const tools: IToolAdapter[] = [];
    for (const [id, config] of this.configs) {
      if (
        (config.type === 'browser' || config.type === 'websearch' || config.type === 'sandbox') &&
        config.enabled
      ) {
        const adapter = this.adapters.get(id);
        if (adapter) {
          tools.push(adapter as IToolAdapter);
        }
      }
    }
    return tools;
  }

  /**
   * Unregister an adapter
   */
  unregister(id: string): void {
    this.adapters.delete(id);
    this.configs.delete(id);
  }

  /**
   * Initialize all enabled adapters
   */
  async initializeAll(): Promise<Map<string, Error>> {
    const errors = new Map<string, Error>();

    for (const [id, config] of this.configs) {
      if (!config.enabled) continue;

      const adapter = this.adapters.get(id);
      if (!adapter) {
        errors.set(id, new Error('Adapter not found'));
        continue;
      }

      try {
        await adapter.init(config.config);
      } catch (error) {
        errors.set(id, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return errors;
  }

  /**
   * Destroy all adapters
   */
  async destroyAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.destroy();
      } catch (error) {
        console.error(`Failed to destroy adapter ${adapter.id}:`, error);
      }
    }
    this.adapters.clear();
    this.configs.clear();
  }
}