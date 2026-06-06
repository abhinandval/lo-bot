import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { parse } from 'yaml';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AppConfig } from './types.js';

// Get project root (directory of this file -> src/config -> project root)
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = dirname(dirname(dirname(__filename)));

function getDefaultModelsStore(): string {
  return `${PROJECT_ROOT}/.models`;
}

const DEFAULT_CONFIG: AppConfig = {
  llm: {
    adapter: 'llamacpp',
    modelPath: '~/.lo-bot/models/gemma4-8b.gguf',
    contextSize: 4096,
    gpuLayers: 0,
    temperature: 0.7,
    topP: 0.9,
    repeatPenalty: 1.1,
    seed: null
  },
  tts: {
    adapter: 'kokoro',
    baseUrl: 'http://localhost:8880',
    defaultVoice: 'af_bella'
  },
  stt: {
    adapter: 'whisper',
    apiUrl: 'http://localhost:8000',
    vad: {
      silenceThreshold: -40,
      minSpeechDuration: 250,
      silenceTimeout: 1000,
      prefixPadding: 300,
      maxRecordingDuration: 60000
    }
  },
  browser: {
    adapter: 'playwright',
    headless: true
  },
  search: {
    adapter: 'searxng',
    baseUrl: 'http://localhost:8080'
  },
  sandbox: {
    adapter: 'docker',
    image: 'alpine:latest',
    timeout: 30000,
    allowNetwork: false
  },
  paths: {
    modelsStore: getDefaultModelsStore()
  }
};

/**
 * Load configuration from file or use defaults
 */
export async function loadConfig(configPath?: string): Promise<AppConfig> {
  const paths = [
    configPath,
    './config/adapters.yaml',
    '~/.config/lo-bot/adapters.yaml',
    '/etc/lo-bot/adapters.yaml'
  ].filter(Boolean) as string[];

  for (const path of paths) {
    const expandedPath = path.replace(/^~/, process.env.HOME ?? '~');
    if (existsSync(expandedPath)) {
      const content = await readFile(expandedPath, 'utf8');
      const parsed = parse(content) as Partial<AppConfig>;
      return mergeConfig(DEFAULT_CONFIG, parsed);
    }
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(defaults: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    llm: { ...defaults.llm, ...override.llm },
    tts: { ...defaults.tts, ...override.tts },
    stt: { ...defaults.stt, ...override.stt },
    browser: { ...defaults.browser, ...override.browser },
    search: { ...defaults.search, ...override.search },
    sandbox: { ...defaults.sandbox, ...override.sandbox },
    paths: { ...defaults.paths, ...override.paths }
  };
}

/**
 * Get the models store path.
 * Priority: MODELS_STORE env var > config > default
 */
export function getModelsStorePath(config: AppConfig): string {
  // Environment variable takes highest priority
  if (process.env.MODELS_STORE) {
    return resolvePath(process.env.MODELS_STORE);
  }
  // Then config value
  if (config.paths?.modelsStore) {
    return resolvePath(config.paths.modelsStore);
  }
  // Finally default
  return getDefaultModelsStore();
}

/**
 * Resolve a path, expanding ~ and environment variables
 */
export function resolvePath(path: string): string {
  return path
    .replace(/^~/, process.env.HOME ?? '~')
    .replace(/\$\{MODELS_STORE\}|\$MODELS_STORE/g, process.env.MODELS_STORE ?? getDefaultModelsStore());
}