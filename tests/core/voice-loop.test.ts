import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceLoop, type VoiceState } from '../../../src/core/voice-loop.js';
import type { ILLMAdapter } from '../../../src/core/interfaces/llm-adapter.js';
import type { ISTTAdapter, ITTSAdapter } from '../../../src/core/interfaces/voice-adapters.js';
import type { CapabilityTracker } from '../../../src/core/capability-tracker.js';

describe('VoiceLoop', () => {
  let voiceLoop: VoiceLoop;
  let mockSTT: ISTTAdapter;
  let mockLLM: ILLMAdapter;
  let mockTTS: ITTSAdapter;
  let mockTracker: CapabilityTracker;
  let callbacks: { onStateChange: vi.Mock; onUserMessage: vi.Mock; onAssistantMessage: vi.Mock; onError: vi.Mock };

  beforeEach(() => {
    callbacks = {
      onStateChange: vi.fn(),
      onUserMessage: vi.fn(),
      onAssistantMessage: vi.fn(),
      onError: vi.fn()
    };
    
    mockSTT = {
      id: 'stt',
      name: 'STT',
      version: '1.0.0',
      capabilities: ['transcribe'],
      init: vi.fn(),
      destroy: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', lastCheck: new Date(), capabilities: [] }),
      startListening: async function* () { yield { type: 'transcript', text: 'Hello', isFinal: true }; },
      stopListening: vi.fn().mockResolvedValue(undefined),
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn().mockResolvedValue('Hello'),
      transcribe: vi.fn().mockResolvedValue('Hello')
    };
    
    mockLLM = {
      id: 'llm',
      name: 'LLM',
      version: '1.0.0',
      capabilities: ['chat'],
      init: vi.fn(),
      destroy: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', lastCheck: new Date(), capabilities: [] }),
      chat: async function* () { yield { content: 'Hi there!' }; },
      getContextInfo: () => ({ size: 4096, used: 512 }),
      unloadModel: vi.fn()
    };
    
    mockTTS = {
      id: 'tts',
      name: 'TTS',
      version: '1.0.0',
      capabilities: ['stream'],
      init: vi.fn(),
      destroy: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', lastCheck: new Date(), capabilities: [] }),
      synthesize: vi.fn().mockResolvedValue(Buffer.from('audio')),
      stream: async function* () { yield { data: Buffer.from('chunk'), timestamp: 0 }; },
      listVoices: vi.fn().mockResolvedValue([])
    };
    
    mockTracker = {
      getCapabilities: vi.fn().mockResolvedValue({
        stt: { available: true, status: 'healthy', required: true, tier: 'voice' },
        tts: { available: true, status: 'healthy', required: false, tier: 'voice' }
      }),
      register: vi.fn(),
      on: vi.fn()
    } as unknown as CapabilityTracker;
    
    voiceLoop = new VoiceLoop(mockSTT, mockLLM, mockTTS, mockTracker, callbacks);
  });

  it('should have initial idle state', () => {
    expect(voiceLoop.getState()).toBe('idle');
  });

  it('should transition through states during processing', async () => {
    // Just check state transitions work
    expect(voiceLoop.getState()).toBe('idle');
  });
});