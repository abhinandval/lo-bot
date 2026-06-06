import { describe, it, expect, beforeEach } from 'vitest';
import { KokoroTTSAdapter } from '../../../src/adapters/tts/kokoro-tts-adapter.js';

describe('KokoroTTSAdapter', () => {
  let adapter: KokoroTTSAdapter;

  beforeEach(() => {
    adapter = new KokoroTTSAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('kokoro');
    expect(adapter.name).toBe('Kokoro TTS');
    expect(adapter.capabilities).toContain('synthesize');
    expect(adapter.capabilities).toContain('stream');
  });

  it('should return offline health when not initialized', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe('offline');
    expect(health.error).toContain('not initialized');
  });
});