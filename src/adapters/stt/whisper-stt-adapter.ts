import type { ISTTAdapter, ListenOptions, TranscriptionEvent } from '../../core/interfaces/voice-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface WhisperSTTConfig {
  apiUrl: string;
  model?: string;
  language?: string;
}

/**
 * Whisper STT adapter using HTTP/WebSocket to Python service
 */
export class WhisperSTTAdapter implements ISTTAdapter {
  readonly id = 'whisper';
  readonly name = 'Whisper STT';
  readonly version = '1.0.0';
  readonly capabilities = ['transcribe', 'stream'];

  private config?: WhisperSTTConfig;
  private abortController?: AbortController;
  private ws?: WebSocket;

  async init(config: WhisperSTTConfig): Promise<void> {
    this.config = config;
  }

  async destroy(): Promise<void> {
    await this.stopListening();
    this.config = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Not initialized'
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.config.apiUrl}/health`);
      return {
        status: response.ok ? 'healthy' : 'error',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  async *startListening(options: ListenOptions = {}): AsyncIterable<TranscriptionEvent> {
    if (!this.config) throw new Error('Not initialized');

    const mode = options.mode ?? 'vad';

    if (mode === 'vad') {
      yield* this.vadListening();
    } else if (mode === 'push-to-talk') {
      yield { type: 'vad', state: 'silence' };
    } else {
      throw new Error(`Mode ${mode} not implemented`);
    }
  }

  private async *vadListening(): AsyncIterable<TranscriptionEvent> {
    if (!this.config) return;

    const wsUrl = this.config.apiUrl.replace('http', 'ws') + '/stream';
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.abortController = new AbortController();

      yield { type: 'vad', state: 'silence' };

      // Wait for WebSocket to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('No WS'));
        
        this.ws.onopen = () => resolve();
        this.ws.onerror = (e) => reject(e);
      });

      // Process messages
      for await (const event of this.wsMessages()) {
        if (this.abortController?.signal.aborted) break;
        yield event;
      }
    } catch (error) {
      yield { type: 'error', error: error instanceof Error ? error.message : 'Stream error' };
    }
  }

  private async *wsMessages(): AsyncGenerator<TranscriptionEvent> {
    if (!this.ws) return;

    const queue: TranscriptionEvent[] = [];
    let resolveNext: ((value: IteratorResult<TranscriptionEvent>) => void) | null = null;

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        const eventObj: TranscriptionEvent = data;

        if (resolveNext) {
          resolveNext({ value: eventObj, done: false });
          resolveNext = null;
        } else {
          queue.push(eventObj);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    while (this.ws.readyState === WebSocket.OPEN) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        const promise = new Promise<IteratorResult<TranscriptionEvent>>((resolve) => {
          resolveNext = resolve;
        });
        
        const result = await Promise.race([
          promise,
          new Promise<never>((_, reject) => {
            this.abortController?.signal.addEventListener('abort', () => reject(new Error('Aborted')));
          })
        ]);
        
        if (result.done) break;
        yield result.value;
      }
    }
  }

  async stopListening(): Promise<void> {
    this.abortController?.abort();
    this.abortController = undefined;

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  async startRecording(): Promise<void> {
    // Push-to-talk start - would connect to streaming endpoint
  }

  async stopRecording(): Promise<string> {
    // Push-to-talk end - return transcription
    return '';
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.config) throw new Error('Not initialized');

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)]), 'audio.wav');
    formData.append('model', this.config.model ?? 'whisper-1');
    if (this.config.language) {
      formData.append('language', this.config.language);
    }

    const response = await fetch(`${this.config.apiUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status}`);
    }

    const data = await response.json() as { text: string };
    return data.text;
  }
}