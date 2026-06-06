/**
 * Configuration type definitions for Lo-Bot
 */

export interface LLMConfig {
  adapter: 'llamacpp' | 'ollama';
  modelPath: string;
  contextSize: number;
  gpuLayers: number;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  seed: number | null;
}

export interface TTSConfig {
  adapter: 'kokoro';
  baseUrl: string;
  defaultVoice: string;
}

export interface STTConfig {
  adapter: 'whisper';
  apiUrl: string;
  vad: {
    silenceThreshold: number;
    minSpeechDuration: number;
    silenceTimeout: number;
    prefixPadding: number;
    maxRecordingDuration: number;
  };
}

export interface BrowserConfig {
  adapter: 'playwright' | 'puppeteer';
  headless: boolean;
}

export interface SearchConfig {
  adapter: 'searxng';
  baseUrl: string;
}

export interface SandboxConfig {
  adapter: 'docker';
  image: string;
  timeout: number;
  allowNetwork: boolean;
}

export interface AppConfig {
  llm: LLMConfig;
  tts: TTSConfig;
  stt: STTConfig;
  browser: BrowserConfig;
  search: SearchConfig;
  sandbox: SandboxConfig;
}