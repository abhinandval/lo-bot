import { describe, it, expect } from 'vitest';
import type { IToolAdapter, ToolDefinition, ToolResult } from '../../../src/core/interfaces/tool-adapters.js';

describe('IToolAdapter interface', () => {
  it('should define required properties', () => {
    const mockAdapter: IToolAdapter = {
      id: 'test-tool',
      name: 'Test Tool',
      version: '1.0.0',
      capabilities: ['test'],
      tools: [
        {
          name: 'test_action',
          description: 'Test action',
          parameters: { type: 'object', properties: {} }
        }
      ],
      isDestructive: false,
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({
        status: 'healthy',
        lastCheck: new Date(),
        capabilities: ['test']
      }),
      execute: async () => ({ success: true })
    };

    expect(mockAdapter.tools).toHaveLength(1);
    expect(mockAdapter.isDestructive).toBe(false);
    expect(typeof mockAdapter.execute).toBe('function');
  });

  it('should have tool result shape', () => {
    const result: ToolResult = {
      success: true,
      data: { message: 'hello' }
    };
    expect(result.success).toBe(true);
  });
});