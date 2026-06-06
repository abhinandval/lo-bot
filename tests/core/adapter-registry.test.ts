import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdapterRegistry } from '../../src/core/adapter-registry.js';
import type { IBaseAdapter } from '../../src/core/types.js';

const createMockAdapter = (id: string): IBaseAdapter => ({
  id,
  name: id,
  version: '1.0.0',
  capabilities: ['test'],
  init: vi.fn(),
  destroy: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({
    status: 'healthy',
    lastCheck: new Date(),
    capabilities: ['test']
  })
});

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('should register adapters', () => {
    const adapter = createMockAdapter('test');
    registry.register({ type: 'llm', id: 'test', enabled: true, tier: 'critical', config: {} }, adapter);
    expect(registry.get('test')).toBe(adapter);
  });

  it('should get LLM adapter by type', () => {
    const llmAdapter = createMockAdapter('llamacpp');
    registry.register({ type: 'llm', id: 'llamacpp', enabled: true, tier: 'critical', config: {} }, llmAdapter);
    
    const llm = registry.getLLM();
    expect(llm?.id).toBe('llamacpp');
  });

  it('should get all enabled adapters', () => {
    const adapter1 = createMockAdapter('adapter1');
    const adapter2 = createMockAdapter('adapter2');
    
    registry.register({ type: 'llm', id: 'adapter1', enabled: true, tier: 'critical', config: {} }, adapter1);
    registry.register({ type: 'tts', id: 'adapter2', enabled: true, tier: 'voice', config: {} }, adapter2);
    
    const enabled = registry.getEnabled();
    expect(enabled).toHaveLength(2);
  });

  it('should initialize all adapters', async () => {
    const adapter = createMockAdapter('test');
    registry.register({ type: 'llm', id: 'test', enabled: true, tier: 'critical', config: {} }, adapter);
    
    const errors = await registry.initializeAll();
    expect(errors.size).toBe(0);
    expect(adapter.init).toHaveBeenCalled();
  });
});