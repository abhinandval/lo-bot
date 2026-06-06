import { describe, it, expect } from 'vitest';
import type { ITTSAdapter, Voice, TTSOptions } from '../../../src/core/interfaces/voice-adapters.js';
import type { AudioChunk } from '../../../src/core/types.js';

describe('ITTSAdapter interface', () => {
  it('should define synthesize and stream methods', async () => {
    const mockAdapter: ITTSAdapter = {
      id: 'test-tts',
      name: 'Test TTS',
      version: '1.0.0',
      capabilities: ['synthesize', 'stream'],
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({
        status: 'healthy',
        lastCheck: new Date(),
        capabilities: ['synthesize', 'stream']
      }),
      synthesize: async (text) => Buffer.from('mock-audio'),
      stream: async function* (text) {
        yield { data: Buffer.from('chunk1'), timestamp: 0 };
      },
      listVoices: async () => [
        { id: 'af_bella', name: 'Bella', language: 'en', gender: 'female' }
      ]
    };

    // Test synthesize
    const audio = await mockAdapter.synthesize('Hello');
    expect(audio).toBeInstanceOf(Buffer);

    // Test listVoices
    const voices = await mockAdapter.listVoices();
    expect(voices).toHaveLength(1);
    expect(voices[0].id).toBe('af_bella');

    // Test stream
    const chunks = [];
    for await (const chunk of mockAdapter.stream('Hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
  });
});