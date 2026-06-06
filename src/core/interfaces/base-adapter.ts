import type { HealthStatus } from '../types.js';

/**
 * Base interface that all adapters must implement.
 * Provides common lifecycle and health check methods.
 */
export interface IBaseAdapter {
  /** Unique identifier for this adapter instance */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Version string */
  readonly version: string;

  /** List of capabilities this adapter provides */
  readonly capabilities: string[];

  /**
   * Initialize the adapter with configuration.
   * Called once before any other adapter method.
   */
  init(config: unknown): Promise<void>;

  /**
   * Clean up resources.
   * Called when shutting down or unregistering.
   */
  destroy(): Promise<void>;

  /**
   * Check adapter health status.
   * Should return quickly without side effects.
   */
  healthCheck(): Promise<HealthStatus>;
}