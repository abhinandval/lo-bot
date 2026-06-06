import { EventEmitter } from 'events';
import type { IBaseAdapter, HealthStatus, CapabilityInfo, CapabilityMap } from './types.js';

export type CapabilityTier = 'critical' | 'core' | 'voice' | 'optional';

export interface AdapterEntry {
  tier: CapabilityTier;
  adapter: IBaseAdapter;
  lastHealth?: HealthStatus;
}

/**
 * Central capability tracking system.
 * Tracks all adapter health and availability in real-time.
 */
export class CapabilityTracker extends EventEmitter {
  private adapters = new Map<string, AdapterEntry>();
  private checkInterval?: ReturnType<typeof setInterval>;

  /**
   * Register an adapter with a capability tier
   */
  register(tier: CapabilityTier, adapter: IBaseAdapter): void {
    this.adapters.set(adapter.id, { tier, adapter });
    this.emit('adapter:registered', { id: adapter.id, tier });
  }

  /**
   * Unregister an adapter
   */
  unregister(id: string): void {
    this.adapters.delete(id);
    this.emit('adapter:unregistered', { id });
  }

  /**
   * Check if an adapter is registered
   */
  hasAdapter(id: string): boolean {
    return this.adapters.has(id);
  }

  /**
   * Get an adapter by ID
   */
  getAdapter(id: string): IBaseAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  /**
   * Check health of a specific adapter
   */
  async checkHealth(id: string): Promise<HealthStatus | undefined> {
    const entry = this.adapters.get(id);
    if (!entry) return undefined;

    try {
      const health = await entry.adapter.healthCheck();
      entry.lastHealth = health;
      this.emit('health:updated', { id, health });
      return health;
    } catch (error) {
      const failed: HealthStatus = {
        status: 'error',
        lastCheck: new Date(),
        capabilities: entry.adapter.capabilities,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
      entry.lastHealth = failed;
      this.emit('health:updated', { id, health: failed });
      return failed;
    }
  }

  /**
   * Check health of all registered adapters
   */
  async checkAllHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    
    for (const [id] of this.adapters) {
      const health = await this.checkHealth(id);
      if (health) results.set(id, health);
    }

    return results;
  }

  /**
   * Get current capabilities map
   */
  async getCapabilities(): Promise<CapabilityMap> {
    const caps: CapabilityMap = {};

    for (const [id, entry] of this.adapters) {
      const health = entry.lastHealth ?? await this.checkHealth(id);
      const info: CapabilityInfo = {
        available: health?.status === 'healthy',
        status: health?.status ?? 'offline',
        required: entry.tier === 'critical' || entry.tier === 'core',
        tier: entry.tier
      };

      // Map adapter IDs to capability keys
      if (['llamacpp', 'ollama'].includes(id)) caps.llm = info;
      if (id === 'whisper') caps.stt = info;
      if (id === 'kokoro') caps.tts = info;
      if (['playwright', 'puppeteer'].includes(id)) caps.browser = info;
      if (['searxng', 'ddg'].includes(id)) caps.websearch = info;
      if (['docker', 'firejail'].includes(id)) caps.sandbox = info;
    }

    return caps;
  }

  /**
   * Validate critical adapters - returns whether engine can start
   */
  validateCritical(): { canStart: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const [id, entry] of this.adapters) {
      if (entry.tier === 'critical') {
        const health = entry.lastHealth;
        const available = health?.status === 'healthy';
        if (!available) {
          missing.push(`${id} (${health?.status ?? 'not checked'})`);
        }
      }
    }

    return { canStart: missing.length === 0, missing };
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs = 30000): void {
    this.stopHealthChecks();
    this.checkInterval = setInterval(() => {
      this.checkAllHealth().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopHealthChecks();
    this.removeAllListeners();
    this.adapters.clear();
  }
}