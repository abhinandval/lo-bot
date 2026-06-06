import type { ITTSAdapter, Voice, TTSOptions, AudioChunk } from '../../core/interfaces/voice-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface KokoroConfig {
  baseUrl: string;
  defaultVoice?: string;
}

/**
 * Kokoro TTS adapter using HTTP API (OpenAI-compatible)
 * Connects to local Kokoro-FastAPI service
 */
export class KokoroTTSAdapter implements ITTSAdapter {
  readonly id = 'kokoro';
  readonly name = 'Kokoro TTS';
  readonly version = '1.0.0';
  readonly capabilities = ['synthesize', 'stream'];

  private config?: KokoroConfig;

  async init(config: KokoroConfig): Promise<void> {
    this.config = {
      baseUrl: config.baseUrl,
      defaultVoice: config.defaultVoice ?? 'af_bella'
    };
  }

  async destroy(): Promise<void> {
    this.config = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Adapter not initialized'
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.config.baseUrl}/v1/audio/voices`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options?.voice ?? this.config.defaultVoice,
        response_format: options?.format ?? 'mp3',
        speed: options?.speed ?? 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async *stream(text: string, options?: TTSOptions): AsyncIterable<AudioChunk> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options?.voice ?? this.config.defaultVoice,
        response_format: 'pcm',
        speed: options?.speed ?? 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`TTS stream failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const startTime = Date.now();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        yield {
          data: Buffer.from(value),
          timestamp: Date.now() - startTime
        };
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listVoices(): Promise<Voice[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/voices`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json() as { voices: Array<{ id: string; name?: string; language?: string }> };
    
    return data.voices.map(v => ({
      id: v.id,
      name: v.name ?? v.id,
      language: v.language
    }));
  }
}