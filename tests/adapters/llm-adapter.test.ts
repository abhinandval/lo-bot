import { describe, it, expect } from 'vitest';
import type { ILLMAdapter, ContextInfo } from '../../../src/core/interfaces/llm-adapter.js';

describe('ILLMAdapter interface', () => {
  it('should define chat method returning async iterable', async () => {
    const mockAdapter: ILLMAdapter = {
      id: 'test-llm',
      name: 'Test LLM',
      version: '1.0.0',
      capabilities: ['chat'],
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({
        status: 'healthy',
        lastCheck: new Date(),
        capabilities: ['chat']
      }),
      chat: async function* () {
        yield { content: 'Hello' };
      },
      getContextInfo: () => ({ size: 4096, used: 512 }),
      unloadModel: async () => {}
    };

    const result = [];
    for await (const chunk of mockAdapter.chat([{ role: 'user', content: 'Hi' }])) {
      result.push(chunk);
    }
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello');
  });

  it('should have context info', () => {
    const mockAdapter: ILLMAdapter = {
      id: 'test-llm',
      name: 'Test LLM',
      version: '1.0.0',
      capabilities: ['chat'],
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({ status: 'healthy', lastCheck: new Date(), capabilities: [] }),
      chat: async function*() { yield { content: '' }; },
      getContextInfo: () => ({ size: 8192, used: 2048 }),
      unloadModel: async () => {}
    };

    const info = mockAdapter.getContextInfo();
    expect(info.size).toBe(8192);
    expect(info.used).toBe(2048);
  });
});