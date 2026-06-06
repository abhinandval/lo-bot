import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapabilityTracker } from '../../src/core/capability-tracker.js';
import type { IBaseAdapter, HealthStatus } from '../../src/core/types.js';

const createMockAdapter = (
  id: string,
  opts: { status: HealthStatus['status']; capabilities?: string[] } = { status: 'healthy' }
): IBaseAdapter => ({
  id,
  name: id,
  version: '1.0.0',
  capabilities: opts.capabilities ?? ['test'],
  init: vi.fn(),
  destroy: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({
    status: opts.status,
    lastCheck: new Date(),
    capabilities: opts.capabilities ?? ['test'],
    error: opts.status === 'error' ? 'Test error' : undefined
  })
});

describe('CapabilityTracker', () => {
  let tracker: CapabilityTracker;

  beforeEach(() => {
    tracker = new CapabilityTracker();
  });

  it('should register adapters', () => {
    const adapter = createMockAdapter('test');
    tracker.register('critical', adapter);
    expect(tracker.hasAdapter('test')).toBe(true);
  });

  it('should return undefined for unregistered capability', async () => {
    const caps = await tracker.getCapabilities();
    // Capabilities only returns info for registered adapters
    expect(caps.llm).toBeUndefined();
  });

  it('should check health of registered adapters', async () => {
    const adapter = createMockAdapter('llm', { status: 'healthy', capabilities: ['chat'] });
    tracker.register('critical', adapter);
    
    const health = await tracker.checkHealth('llm');
    expect(health?.status).toBe('healthy');
  });

  it('should validate critical adapters after health check', async () => {
    const adapter = createMockAdapter('llm', { status: 'healthy' });
    tracker.register('critical', adapter);
    
    // Need to check health first
    await tracker.checkHealth('llm');
    
    const result = tracker.validateCritical();
    expect(result.canStart).toBe(true);
  });

  it('should fail validation when critical adapter offline', async () => {
    const adapter = createMockAdapter('llm', { status: 'offline' });
    tracker.register('critical', adapter);
    
    // Need to check health first
    await tracker.checkHealth('llm');
    
    const result = tracker.validateCritical();
    expect(result.canStart).toBe(false);
    expect(result.missing[0]).toContain('llm');
  });
});