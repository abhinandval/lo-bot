import { CapabilityTracker } from './capability-tracker.js';
import { AdapterRegistry } from './adapter-registry.js';
import { VoiceLoop, type VoiceState } from './voice-loop.js';
import { LlamaCppAdapter } from '../adapters/llm/llamacpp-adapter.js';
import { KokoroTTSAdapter } from '../adapters/tts/kokoro-tts-adapter.js';
import { WhisperSTTAdapter } from '../adapters/stt/whisper-stt-adapter.js';
import { PlaywrightBrowserAdapter } from '../adapters/browser/playwright-adapter.js';
import { SearXNGAdapter } from '../adapters/websearch/searxng-adapter.js';
import { DockerSandboxAdapter } from '../adapters/sandbox/docker-sandbox-adapter.js';
import type { AppConfig } from '../config/types.js';
import type { Message, CapabilityMap } from './types.js';

/**
 * Main Lo-Bot Engine
 * Orchestrates all adapters, handles chat, and manages voice mode
 */
export class LoBotEngine {
  tracker = new CapabilityTracker();
  registry = new AdapterRegistry();
  voiceLoop?: VoiceLoop;

  constructor(private config: AppConfig) {}

  async initialize(): Promise<void> {
    // Initialize LLM adapter (CRITICAL)
    const llmAdapter = new LlamaCppAdapter();
    this.registry.register(
      { type: 'llm', id: 'llamacpp', enabled: true, tier: 'critical', config: this.config.llm },
      llmAdapter
    );
    this.tracker.register('critical', llmAdapter);
    await llmAdapter.init(this.config.llm);

    // Check critical capability
    const validation = this.tracker.validateCritical();
    if (!validation.canStart) {
      throw new Error(
        `Critical adapters unavailable: ${validation.missing.join(', ')}`
      );
    }

    // Initialize TTS adapter (VOICE tier)
    const ttsAdapter = new KokoroTTSAdapter();
    this.registry.register(
      { type: 'tts', id: 'kokoro', enabled: true, tier: 'voice', config: this.config.tts },
      ttsAdapter
    );
    this.tracker.register('voice', ttsAdapter);
    await ttsAdapter.init(this.config.tts).catch(err => {
      console.warn('TTS initialization failed:', err.message);
    });

    // Initialize STT adapter (VOICE tier)
    const sttAdapter = new WhisperSTTAdapter();
    this.registry.register(
      { type: 'stt', id: 'whisper', enabled: true, tier: 'voice', config: this.config.stt },
      sttAdapter
    );
    this.tracker.register('voice', sttAdapter);
    await sttAdapter.init(this.config.stt).catch(err => {
      console.warn('STT initialization failed:', err.message);
    });

    // Initialize tool adapters (CORE tier)
    const browserAdapter = new PlaywrightBrowserAdapter();
    this.registry.register(
      { type: 'browser', id: 'playwright', enabled: true, tier: 'core', config: this.config.browser },
      browserAdapter
    );
    this.tracker.register('core', browserAdapter);
    await browserAdapter.init(this.config.browser).catch(err => {
      console.warn('Browser initialization failed:', err.message);
    });

    const searchAdapter = new SearXNGAdapter();
    this.registry.register(
      { type: 'websearch', id: 'searxng', enabled: true, tier: 'core', config: this.config.search },
      searchAdapter
    );
    this.tracker.register('core', searchAdapter);
    await searchAdapter.init(this.config.search).catch(err => {
      console.warn('Search initialization failed:', err.message);
    });

    const sandboxAdapter = new DockerSandboxAdapter();
    this.registry.register(
      { type: 'sandbox', id: 'docker-sandbox', enabled: true, tier: 'core', config: this.config.sandbox },
      sandboxAdapter
    );
    this.tracker.register('core', sandboxAdapter);
    await sandboxAdapter.init(this.config.sandbox).catch(err => {
      console.warn('Sandbox initialization failed:', err.message);
    });

    // Start health checks
    this.tracker.startHealthChecks(30000);

    // Report capabilities
    const caps = await this.tracker.getCapabilities();
    console.log('Capabilities initialized:', caps);
  }

  async chat(message: string, history: Message[] = []): Promise<string> {
    const llm = this.registry.getLLM();
    if (!llm) {
      throw new Error('LLM adapter not available');
    }

    const messages: Message[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...history,
      { role: 'user', content: message }
    ];

    let response = '';
    for await (const chunk of llm.chat(messages)) {
      response += chunk.content;
    }

    return response;
  }

  async startVoiceMode(callbacks: {
    onStateChange: (state: VoiceState) => void;
    onUserMessage: (text: string) => void;
    onAssistantMessage: (text: string) => void;
    onError: (error: string) => void;
  }): Promise<void> {
    const stt = this.registry.get('whisper') as WhisperSTTAdapter;
    const llm = this.registry.getLLM();
    const tts = this.registry.getTTS();

    if (!stt || !llm) {
      throw new Error('STT or LLM adapter not available');
    }

    this.voiceLoop = new VoiceLoop(
      stt,
      llm,
      tts,
      this.tracker,
      callbacks
    );

    await this.voiceLoop.start();
  }

  async stopVoiceMode(): Promise<void> {
    await this.voiceLoop?.stop();
    this.voiceLoop = undefined;
  }

  async getCapabilities(): Promise<CapabilityMap> {
    return this.tracker.getCapabilities();
  }

  private getSystemPrompt(): string {
    const caps = this.tracker.getCapabilities();
    const tools: string[] = [];

    if (caps.browser?.available) tools.push('browser');
    if (caps.websearch?.available) tools.push('web search');
    if (caps.sandbox?.available) tools.push('code execution sandbox');

    return `You are Lo-Bot, a helpful local AI assistant. ` +
      `Available tools: ${tools.join(', ') || 'none'}. ` +
      `Respond concisely and helpfully.`;
  }

  async destroy(): Promise<void> {
    this.tracker.stopHealthChecks();
    await this.registry.destroyAll();
    this.tracker.destroy();
  }
}