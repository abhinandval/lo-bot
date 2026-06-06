import type { IBaseAdapter, Voice, TTSOptions, AudioChunk } from '../types.js';

/**
 * Text-to-Speech Adapter Interface
 * All TTS adapters must implement this interface.
 */
export interface ITTSAdapter extends IBaseAdapter {
  /**
   * Synthesize text to audio file.
   */
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;

  /**
   * Stream audio chunks as they're generated.
   * Lower latency than synthesize for longer texts.
   */
  stream(text: string, options?: TTSOptions): AsyncIterable<AudioChunk>;

  /**
   * List available voices.
   */
  listVoices(): Promise<Voice[]>;
}

// Re-export types from core for convenience
export type { Voice, TTSOptions, AudioChunk } from '../types.js';