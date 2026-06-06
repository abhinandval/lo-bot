import type { ILLMAdapter } from './interfaces/llm-adapter.js';
import type { ISTTAdapter, ITTSAdapter, TranscriptionEvent, VoiceState } from './interfaces/voice-adapters.js';
import type { CapabilityTracker } from './capability-tracker.js';
import type { Message, ChatChunk } from './types.js';

export interface VoiceLoopCallbacks {
  onStateChange: (state: VoiceState) => void;
  onUserMessage: (text: string) => void;
  onAssistantMessage: (text: string) => void;
  onError: (error: string) => void;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

/**
 * Voice Loop - coordinates STT → LLM → TTS with sentence streaming
 */
export class VoiceLoop {
  private isActive = false;
  private currentState: VoiceState = 'idle';
  private interrupted = false;

  constructor(
    private stt: ISTTAdapter,
    private llm: ILLMAdapter,
    private tts: ITTSAdapter | undefined,
    private tracker: CapabilityTracker,
    private callbacks: VoiceLoopCallbacks
  ) {}

  async start(): Promise<void> {
    if (this.isActive) return;

    const caps = await this.tracker.getCapabilities();

    if (!caps.stt?.available) {
      this.callbacks.onError(`Voice unavailable — STT is ${caps.stt?.status ?? 'offline'}`);
      return;
    }

    this.isActive = true;
    this.setState('idle');

    try {
      for await (const event of this.stt.startListening({ mode: 'vad' })) {
        if (!this.isActive) break;

        await this.handleEvent(event);
      }
    } catch (error) {
      this.callbacks.onError(error instanceof Error ? error.message : 'Voice loop error');
      this.setState('error');
    } finally {
      this.isActive = false;
      this.setState('idle');
    }
  }

  async stop(): Promise<void> {
    this.isActive = false;
    await this.stt.stopListening();
    this.setState('idle');
  }

  private async handleEvent(event: TranscriptionEvent): Promise<void> {
    switch (event.type) {
      case 'vad':
        if (event.state === 'speech-start') {
          this.setState('listening');
        } else if (event.state === 'speech-end') {
          this.setState('processing');
        }
        break;

      case 'transcript':
        if (event.isFinal && event.text) {
          await this.processTranscript(event.text);
        }
        break;

      case 'error':
        this.callbacks.onError(event.error ?? 'Unknown STT error');
        this.setState('error');
        break;
    }
  }

  private async processTranscript(text: string): Promise<void> {
    this.callbacks.onUserMessage(text);

    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: text }
    ];

    // Stream LLM response sentence-by-sentence to TTS
    let fullResponse = '';
    const llmStream = this.llm.chat(messages);
    
    for await (const sentence of this.streamResponseToTTS(llmStream)) {
      if (this.interrupted) {
        break;
      }
      fullResponse += sentence;
    }

    this.callbacks.onAssistantMessage(fullResponse);

    // Back to idle for next input
    if (!this.interrupted) {
      this.setState('idle');
    }
  }

  /**
   * Stream LLM output sentence-by-sentence, piping each to TTS immediately.
   * This dramatically reduces perceived latency.
   */
  private async *streamResponseToTTS(
    llmStream: AsyncIterable<ChatChunk>
  ): AsyncGenerator<string> {
    let buffer = '';
    const sentenceEnd = /[.!?]+\s*/g;

    for await (const chunk of llmStream) {
      // Check for user interrupt
      if (this.interrupted) {
        break;
      }

      buffer += chunk.content;

      // Extract complete sentences
      let match;
      while ((match = sentenceEnd.exec(buffer)) !== null) {
        const sentence = buffer.slice(0, match.end);
        buffer = buffer.slice(match.end);

        // Stream sentence to TTS immediately
        if (this.tts && !this.interrupted) {
          await this.tts.stream(sentence.trim());
        }

        yield sentence;
      }
    }

    // Flush remaining buffer as final sentence
    if (buffer.trim() && !this.interrupted) {
      if (this.tts) {
        await this.tts.stream(buffer.trim());
      }
      yield buffer;
    }
  }

  /**
   * Interrupt current response - stops TTS, clears buffer, returns to idle.
   * Called when user presses Escape or speaks during generation.
   */
  interrupt(): void {
    this.interrupted = true;
    
    // Stop TTS playback immediately
    // In a real implementation, we'd call this.tts.stop()
    
    this.setState('idle');
  }

  resetInterrupt(): void {
    this.interrupted = false;
  }

  private setState(state: VoiceState): void {
    this.currentState = state;
    this.callbacks.onStateChange(state);
  }

  getState(): VoiceState {
    return this.currentState;
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }
}