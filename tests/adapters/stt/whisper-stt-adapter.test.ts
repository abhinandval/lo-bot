import { describe, it, expect, beforeEach } from 'vitest';
import { WhisperSTTAdapter } from '../../../src/adapters/stt/whisper-stt-adapter.js';

describe('WhisperSTTAdapter', () => {
  let adapter: WhisperSTTAdapter;

  beforeEach(() => {
    adapter = new WhisperSTTAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('whisper');
    expect(adapter.name).toBe('Whisper STT');
    expect(adapter.capabilities).toContain('transcribe');
    expect(adapter.capabilities).toContain('stream');
  });
});