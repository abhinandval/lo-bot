import type { Voice, TTSOptions, AudioChunk, Message, ChatChunk } from '../types.js';
import type { IBaseAdapter } from './base-adapter.js';

// Re-export for convenience
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

// ============================================================================
// TTS Adapter Interface
// ============================================================================

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

// ============================================================================
// STT Adapter Interface
// ============================================================================

export interface VADConfig {
  silenceThreshold?: number;
  minSpeechDuration?: number;
  silenceTimeout?: number;
  prefixPadding?: number;
  maxRecordingDuration?: number;
}

export interface ListenOptions {
  mode?: 'vad' | 'push-to-talk' | 'wake-word';
  wakeWord?: string;
  vadConfig?: VADConfig;
}

export type TranscriptionEvent =
  | { type: 'vad'; state: 'speech-start' | 'speech-end' | 'silence' }
  | { type: 'transcript'; text: string; isFinal: boolean }
  | { type: 'error'; error: string };

/**
 * Speech-to-Text Adapter Interface
 * All STT adapters must implement this interface.
 */
export interface ISTTAdapter extends IBaseAdapter {
  /**
   * Start VAD-enabled listening (default mode)
   */
  startListening(options?: ListenOptions): AsyncIterable<TranscriptionEvent>;

  /**
   * Stop listening
   */
  stopListening(): Promise<void>;

  /**
   * Start push-to-talk recording
   */
  startRecording(): Promise<void>;

  /**
   * Stop recording and return transcript
   */
  stopRecording(): Promise<string>;

  /**
   * Batch transcription of audio buffer
   */
  transcribe(audioBuffer: Buffer): Promise<string>;
}

// Re-export types from core for convenience
export type { Voice, TTSOptions, AudioChunk, Message, ChatChunk } from '../types.js';