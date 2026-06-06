import { describe, it, expect } from 'vitest';
import type { HealthStatus, IBaseAdapter, Message, ChatChunk, CapabilityInfo } from '../../src/core/types';

describe('HealthStatus', () => {
  it('should accept valid health status', () => {
    const status: HealthStatus = {
      status: 'healthy',
      lastCheck: new Date(),
      latency: 100,
      error: undefined,
      capabilities: ['chat']
    };
    expect(status.status).toBe('healthy');
  });

  it('should accept error status with error message', () => {
    const status: HealthStatus = {
      status: 'error',
      lastCheck: new Date(),
      error: 'Connection failed',
      capabilities: []
    };
    expect(status.status).toBe('error');
    expect(status.error).toBe('Connection failed');
  });
});

describe('Message', () => {
  it('should create user message', () => {
    const msg: Message = { role: 'user', content: 'Hello' };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('should create assistant message', () => {
    const msg: Message = { role: 'assistant', content: 'Hi there!' };
    expect(msg.role).toBe('assistant');
  });
});

describe('ChatChunk', () => {
  it('should create chunk with content', () => {
    const chunk: ChatChunk = { content: 'Hello' };
    expect(chunk.content).toBe('Hello');
  });

  it('should mark chunk as done', () => {
    const chunk: ChatChunk = { content: 'Done', done: true };
    expect(chunk.done).toBe(true);
  });
});

describe('CapabilityInfo', () => {
  it('should track critical capability', () => {
    const info: CapabilityInfo = {
      available: true,
      status: 'healthy',
      required: true,
      tier: 'critical'
    };
    expect(info.tier).toBe('critical');
    expect(info.required).toBe(true);
  });
});