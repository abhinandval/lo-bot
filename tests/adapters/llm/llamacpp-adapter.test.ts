import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LlamaCppAdapter } from '../../../src/adapters/llm/llamacpp-adapter.js';

describe('LlamaCppAdapter', () => {
  let adapter: LlamaCppAdapter;

  beforeEach(() => {
    adapter = new LlamaCppAdapter();
  });

  it('should have correct adapter metadata', () => {
    expect(adapter.id).toBe('llamacpp');
    expect(adapter.name).toBe('llama.cpp');
    expect(adapter.capabilities).toContain('chat');
  });

  it('should return offline health when not initialized', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe('offline');
  });
});