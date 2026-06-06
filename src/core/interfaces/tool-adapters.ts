import type { IBaseAdapter } from './base-adapter.js';

/**
 * Tool definition with JSON Schema for parameters
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Base interface for all tool adapters.
 * All tool adapters must implement this interface.
 */
export interface IToolAdapter extends IBaseAdapter {
  /** List of tools this adapter provides */
  readonly tools: ToolDefinition[];
  
  /** Whether this adapter can modify system state */
  readonly isDestructive: boolean;
  
  /**
   * Execute a tool with given parameters
   * @param toolName - Name of the tool from this.tools
   * @param params - Tool-specific parameters
   */
  execute(toolName: string, params: unknown): Promise<ToolResult>;
}