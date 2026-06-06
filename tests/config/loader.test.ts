import { describe, it, expect, beforeAll } from 'vitest';
import { loadConfig, getModelsStorePath, resolvePath } from '../../../src/config/loader.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Config Loader', () => {
  it('should load default config', async () => {
    const config = await loadConfig();
    expect(config.llm.adapter).toBe('llamacpp');
    expect(config.tts.adapter).toBe('kokoro');
    expect(config.stt.adapter).toBe('whisper');
  });

  it('should have default modelsStore path', async () => {
    const config = await loadConfig();
    expect(config.paths?.modelsStore).toBeDefined();
    expect(config.paths.modelsStore).toContain('.models');
  });

  it('should resolve modelsStore from env var', async () => {
    const original = process.env.MODELS_STORE;
    process.env.MODELS_STORE = '/custom/models/path';
    
    const config = await loadConfig();
    expect(getModelsStorePath(config)).toBe('/custom/models/path');
    
    if (original) process.env.MODELS_STORE = original;
    else delete process.env.MODELS_STORE;
  });

  it('should resolve ~ in paths', () => {
    const originalHome = process.env.HOME;
    process.env.HOME = '/home/user';
    
    expect(resolvePath('~/models')).toBe('/home/user/models');
    
    if (originalHome) process.env.HOME = originalHome;
  });

  it('should resolve MODELS_STORE in paths', () => {
    const original = process.env.MODELS_STORE;
    process.env.MODELS_STORE = '/custom/store';
    
    expect(resolvePath('$MODELS_STORE/model.gguf')).toBe('/custom/store/model.gguf');
    expect(resolvePath('${MODELS_STORE}/model.gguf')).toBe('/custom/store/model.gguf');
    
    if (original) process.env.MODELS_STORE = original;
    else delete process.env.MODELS_STORE;
  });
});