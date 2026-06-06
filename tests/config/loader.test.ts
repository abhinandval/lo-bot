import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../../src/config/loader.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

describe('Config Loader', () => {
  it('should load default config', async () => {
    const config = await loadConfig();
    expect(config.llm.adapter).toBe('llamacpp');
    expect(config.tts.adapter).toBe('kokoro');
    expect(config.stt.adapter).toBe('whisper');
  });
});