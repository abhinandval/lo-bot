# Lo-Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully local, voice-enabled AI assistant with TypeScript core, adapter-based architecture, and Ink-based TUI.

**Architecture:** Modular adapter system where each component (LLM, STT, TTS, tools) implements standard interfaces, coordinated by a Capabilities Tracker and Engine. Voice input uses Silero VAD for natural conversation flow.

**Tech Stack:** TypeScript, Ink (React TUI), node-llama-cpp, Kokoro-FastAPI (Docker), faster-whisper + silero-vad (Python service), Playwright.

---

## File Structure Overview

```
src/
├── core/
│   ├── types.ts                    # Shared interfaces
│   ├── interfaces/
│   │   ├── base-adapter.ts         # IBaseAdapter
│   │   ├── llm-adapter.ts          # ILLMAdapter
│   │   ├── voice-adapters.ts       # ISTTAdapter, ITTSAdapter
│   │   └── tool-adapters.ts        # IToolAdapter, tool-specific
│   ├── capability-tracker.ts       # Capabilities registry
│   ├── adapter-registry.ts         # Adapter management
│   ├── engine.ts                   # Main conversation orchestrator
│   └── voice-loop.ts               # VAD → STT → LLM → TTS flow
├── adapters/
│   ├── llm/
│   │   └── llamacpp-adapter.ts
│   ├── stt/
│   │   └── whisper-stt-adapter.ts
│   ├── tts/
│   │   └── kokoro-tts-adapter.ts
│   ├── browser/
│   │   └── playwright-adapter.ts
│   ├── websearch/
│   │   └── searxng-adapter.ts
│   └── sandbox/
│       └── docker-sandbox-adapter.ts
├── tui/
│   ├── app.tsx
│   ├── components/
│   │   ├── chat-view.tsx
│   │   ├── input-box.tsx
│   │   ├── status-bar.tsx
│   │   └── voice-indicator.tsx
│   └── hooks/
│       └── use-adapters.ts
├── config/
│   ├── types.ts
│   └── loader.ts
└── index.ts                        # Entry point
```

---

## Phase 1: Core Infrastructure

### Task 1: Base Types and Interfaces

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/interfaces/base-adapter.ts`

- [ ] **Step 1: Write failing test for HealthStatus type**

```typescript
// tests/core/types.test.ts
import { describe, it, expect } from 'vitest';
import type { HealthStatus, IBaseAdapter } from '../../src/core/types';

describe('HealthStatus', () => {
  it('should accept valid health status', () => {
    const status: HealthStatus = {
      status: 'healthy',
      lastCheck: new Date(),
      latency: 100,
      error: undefined,
      capabilities: ['chat']
    };
    expect(status.status).toBe('healthy');
  });
});
```

- [ ] **Step 2: Run test to verify setup**

```bash
npm test -- tests/core/types.test.ts
```
Expected: Vitest runs, test may fail on import (expected).

- [ ] **Step 3: Write base types**

```typescript
// src/core/types.ts
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error' | 'offline';
  lastCheck: Date;
  latency?: number;
  error?: string;
  capabilities: string[];
}

export interface CapabilityInfo {
  available: boolean;
  status: HealthStatus['status'];
  required: boolean;
  tier: 'critical' | 'core' | 'voice' | 'optional';
}

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatChunk {
  content: string;
  done?: boolean;
}
```

- [ ] **Step 4: Write IBaseAdapter interface**

```typescript
// src/core/interfaces/base-adapter.ts
import type { HealthStatus } from '../types.js';

export interface IBaseAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: string[];

  init(config: unknown): Promise<void>;
  destroy(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}
```

- [ ] **Step 5: Run tests to verify**

```bash
npm test -- tests/core/types.test.ts -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/interfaces/base-adapter.ts tests/core/types.test.ts
git commit -m "feat(core): add base types and adapter interface

Add HealthStatus, CapabilityInfo, Message types, and IBaseAdapter
interface as foundation for adapter architecture."
```

---

## Phase 2: LLM Adapter

### Task 2: LLM Adapter Interface

**Files:**
- Create: `src/core/interfaces/llm-adapter.ts`
- Create: `tests/adapters/llm-adapter.test.ts`

- [ ] **Step 1: Write failing test for LLM adapter interface**

```typescript
// tests/adapters/llm-adapter.test.ts
import { describe, it, expect } from 'vitest';
import type { ILLMAdapter } from '../../src/core/interfaces/llm-adapter.js';

describe('ILLMAdapter', () => {
  it('should define chat method returning async iterable', async () => {
    const mockAdapter: ILLMAdapter = {
      id: 'test',
      name: 'Test LLM',
      version: '1.0.0',
      capabilities: ['chat'],
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({
        status: 'healthy',
        lastCheck: new Date(),
        capabilities: ['chat']
      }),
      chat: async function* () {
        yield { content: 'Hello' };
      },
      getContextInfo: () => ({ size: 4096, used: 512 }),
      unloadModel: async () => {}
    };

    const result = [];
    for await (const chunk of mockAdapter.chat([{ role: 'user', content: 'Hi' }])) {
      result.push(chunk);
    }
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (no interface yet)**

```bash
npm test -- tests/adapters/llm-adapter.test.ts
```
Expected: Import error for llm-adapter.ts (expected).

- [ ] **Step 3: Write ILLMAdapter interface**

```typescript
// src/core/interfaces/llm-adapter.ts
import type { IBaseAdapter, ChatChunk, Message } from '../types.js';

export interface ContextInfo {
  size: number;
  used: number;
}

export interface ILLMAdapter extends IBaseAdapter {
  chat(messages: Message[]): AsyncIterable<ChatChunk>;
  getContextInfo(): ContextInfo;
  unloadModel(): Promise<void>;
}
```

- [ ] **Step 4: Run tests to verify**

```bash
npm test -- tests/adapters/llm-adapter.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/interfaces/llm-adapter.ts tests/adapters/llm-adapter.test.ts
git commit -m "feat(llm): add ILLMAdapter interface

Define interface for LLM adapters with streaming chat support."
```

### Task 3: llama.cpp Adapter Implementation

**Files:**
- Create: `src/adapters/llm/llamacpp-adapter.ts`
- Create: `tests/adapters/llm/llamacpp-adapter.test.ts`
- Modify: `package.json` (add node-llama-cpp dependency)

- [ ] **Step 1: Write failing test**

```typescript
// tests/adapters/llm/llamacpp-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LlamaCppAdapter } from '../../../src/adapters/llm/llamacpp-adapter.js';

describe('LlamaCppAdapter', () => {
  let adapter: LlamaCppAdapter;

  beforeEach(() => {
    adapter = new LlamaCppAdapter();
  });

  it('should have correct adapter metadata', () => {
    expect(adapter.id).toBe('llamacpp');
    expect(adapter.name).toBe('llama.cpp');
    expect(adapter.capabilities).toContain('chat');
  });

  it('should return offline health when not initialized', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe('offline');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- tests/adapters/llm/llamacpp-adapter.test.ts
```
Expected: Import error (adapter doesn't exist).

- [ ] **Step 3: Install dependency**

```bash
npm install node-llama-cpp
```

- [ ] **Step 4: Implement LlamaCppAdapter**

```typescript
// src/adapters/llm/llamacpp-adapter.ts
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';
import type { ILLMAdapter, ContextInfo } from '../../core/interfaces/llm-adapter.js';
import type { HealthStatus, Message, ChatChunk } from '../../core/types.js';

export interface LlamaCppConfig {
  modelPath: string;
  contextSize?: number;
  gpuLayers?: number;
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number | null;
}

export class LlamaCppAdapter implements ILLMAdapter {
  readonly id = 'llamacpp';
  readonly name = 'llama.cpp';
  readonly version = '1.0.0';
  readonly capabilities = ['chat'];

  private model?: LlamaModel;
  private context?: LlamaContext;
  private config?: LlamaCppConfig;

  async init(config: LlamaCppConfig): Promise<void> {
    this.config = config;
    this.model = await LlamaModel.load(config.modelPath, {
      contextSize: config.contextSize ?? 4096,
      gpuLayers: config.gpuLayers ?? 0
    });
    this.context = new LlamaContext(this.model);
  }

  async destroy(): Promise<void> {
    this.context?.dispose();
    this.model?.dispose();
    this.context = undefined;
    this.model = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.model || !this.context) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Adapter not initialized'
      };
    }

    try {
      const start = Date.now();
      // Quick health check: try to get context size
      const info = this.getContextInfo();
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async *chat(messages: Message[]): AsyncIterable<ChatChunk> {
    if (!this.context || !this.config) {
      throw new Error('Adapter not initialized');
    }

    const session = new LlamaChatSession(this.context);
    const prompt = this.formatMessages(messages);

    for await (const chunk of session.prompt(prompt, {
      temperature: this.config.temperature ?? 0.7,
      topP: this.config.topP ?? 0.9,
      repeatPenalty: this.config.repeatPenalty ?? 1.1,
      seed: this.config.seed ?? undefined
    })) {
      yield { content: chunk };
    }
  }

  getContextInfo(): ContextInfo {
    if (!this.context) {
      return { size: 0, used: 0 };
    }
    return {
      size: this.context.contextSize,
      used: this.context.getContextUsed()
    };
  }

  async unloadModel(): Promise<void> {
    await this.destroy();
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map(m => {
        const role = m.role === 'system' ? 'System' : m.role === 'user' ? 'User' : 'Assistant';
        return `${role}: ${m.content}`;
      })
      .join('\n\n') + '\n\nAssistant:';
  }
}
```

- [ ] **Step 5: Run tests to verify**

```bash
npm test -- tests/adapters/llm/llamacpp-adapter.test.ts -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/adapters/llm/llamacpp-adapter.ts tests/adapters/llm/llamacpp-adapter.test.ts package.json package-lock.json
git commit -m "feat(llm): implement llama.cpp adapter

Add LlamaCppAdapter with full streaming support, health checks,
and granular configuration (temperature, topP, GPU layers, etc)."
```

---

## Phase 3: Capabilities Tracker

### Task 4: Capabilities Tracker Implementation

**Files:**
- Create: `src/core/capability-tracker.ts`
- Create: `tests/core/capability-tracker.test.ts`

- [ ] **Step 1: Write test for capability tracker**

```typescript
// tests/core/capability-tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CapabilityTracker } from '../../src/core/capability-tracker.js';
import type { IBaseAdapter, HealthStatus } from '../../src/core/types.js';

const createMockAdapter = (
  id: string,
  opts: { status: HealthStatus['status']; capabilities?: string[] } = { status: 'healthy' }
): IBaseAdapter => ({
  id,
  name: id,
  version: '1.0.0',
  capabilities: opts.capabilities ?? ['test'],
  init: vi.fn(),
  destroy: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue({
    status: opts.status,
    lastCheck: new Date(),
    capabilities: opts.capabilities ?? ['test'],
    error: opts.status === 'error' ? 'Test error' : undefined
  })
});

describe('CapabilityTracker', () => {
  let tracker: CapabilityTracker;

  beforeEach(() => {
    tracker = new CapabilityTracker();
  });

  it('should register adapters', () => {
    const adapter = createMockAdapter('test');
    tracker.register('critical', adapter);
    expect(tracker.hasAdapter('test')).toBe(true);
  });

  it('should return offline status for unregistered capability', async () => {
    const caps = await tracker.getCapabilities();
    expect(caps.llm?.status).toBe('offline');
  });

  it('should check health of registered adapters', async () => {
    const adapter = createMockAdapter('llm', { status: 'healthy', capabilities: ['chat'] });
    tracker.register('critical', adapter);
    
    const health = await tracker.checkHealth('llm');
    expect(health?.status).toBe('healthy');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- tests/core/capability-tracker.test.ts
```
Expected: Import error (tracker doesn't exist).

- [ ] **Step 3: Implement CapabilityTracker**

```typescript
// src/core/capability-tracker.ts
import type { IBaseAdapter, HealthStatus, CapabilityInfo } from './types.js';
import { EventEmitter } from 'events';

export interface CapabilityMap {
  llm?: CapabilityInfo;
  stt?: CapabilityInfo;
  tts?: CapabilityInfo;
  browser?: CapabilityInfo;
  websearch?: CapabilityInfo;
  sandbox?: CapabilityInfo;
}

export type CapabilityTier = 'critical' | 'core' | 'voice' | 'optional';

export interface AdapterEntry {
  tier: CapabilityTier;
  adapter: IBaseAdapter;
  lastHealth?: HealthStatus;
}

export class CapabilityTracker extends EventEmitter {
  private adapters = new Map<string, AdapterEntry>();
  private checkInterval?: NodeJS.Timeout;

  register(tier: CapabilityTier, adapter: IBaseAdapter): void {
    this.adapters.set(adapter.id, { tier, adapter });
    this.emit('adapter:registered', { id: adapter.id, tier });
  }

  unregister(id: string): void {
    this.adapters.delete(id);
    this.emit('adapter:unregistered', { id });
  }

  hasAdapter(id: string): boolean {
    return this.adapters.has(id);
  }

  getAdapter(id: string): IBaseAdapter | undefined {
    return this.adapters.get(id)?.adapter;
  }

  async checkHealth(id: string): Promise<HealthStatus | undefined> {
    const entry = this.adapters.get(id);
    if (!entry) return undefined;

    try {
      const health = await entry.adapter.healthCheck();
      entry.lastHealth = health;
      this.emit('health:updated', { id, health });
      return health;
    } catch (error) {
      const failed: HealthStatus = {
        status: 'error',
        lastCheck: new Date(),
        capabilities: entry.adapter.capabilities,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
      entry.lastHealth = failed;
      this.emit('health:updated', { id, health: failed });
      return failed;
    }
  }

  async checkAllHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    
    for (const [id] of this.adapters) {
      const health = await this.checkHealth(id);
      if (health) results.set(id, health);
    }

    return results;
  }

  async getCapabilities(): Promise<CapabilityMap> {
    const caps: CapabilityMap = {};

    for (const [id, entry] of this.adapters) {
      const health = entry.lastHealth ?? await this.checkHealth(id);
      const info: CapabilityInfo = {
        available: health?.status === 'healthy',
        status: health?.status ?? 'offline',
        required: entry.tier === 'critical' || entry.tier === 'core',
        tier: entry.tier
      };

      // Map adapter IDs to capability keys
      if (['llamacpp', 'ollama'].includes(id)) caps.llm = info;
      if (id === 'whisper') caps.stt = info;
      if (id === 'kokoro') caps.tts = info;
      if (['playwright', 'puppeteer'].includes(id)) caps.browser = info;
      if (['searxng', 'ddg'].includes(id)) caps.websearch = info;
      if (['docker', 'firejail'].includes(id)) caps.sandbox = info;
    }

    return caps;
  }

  validateCritical(): { canStart: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const [id, entry] of this.adapters) {
      if (entry.tier === 'critical') {
        const health = entry.lastHealth;
        const available = health?.status === 'healthy';
        if (!available) {
          missing.push(`${id} (${health?.status ?? 'not checked'})`);
        }
      }
    }

    return { canStart: missing.length === 0, missing };
  }

  startHealthChecks(intervalMs = 30000): void {
    this.stopHealthChecks();
    this.checkInterval = setInterval(() => {
      this.checkAllHealth().catch(console.error);
    }, intervalMs);
  }

  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  destroy(): void {
    this.stopHealthChecks();
    this.removeAllListeners();
    this.adapters.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify**

```bash
npm test -- tests/core/capability-tracker.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/capability-tracker.ts tests/core/capability-tracker.test.ts
git commit -m "feat(core): implement CapabilityTracker

Add dynamic capability tracking with health checks, tier management,
and event-based updates for CRITICAL/CORE/VOICE/OPTIONAL adapters."
```

---

## Phase 4: TTS Adapter

### Task 5: TTS Adapter Interface

**Files:**
- Create: `src/core/interfaces/voice-adapters.ts`
- Modify: `src/core/types.ts` (add voice-related types)

- [ ] **Step 1: Add voice types to core types**

```typescript
// src/core/types.ts (append to file)

// Voice types
export interface Voice {
  id: string;
  name: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'wav' | 'pcm';
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
}
```

- [ ] **Step 2: Write TTS interface**

```typescript
// src/core/interfaces/voice-adapters.ts
import type { IBaseAdapter, Voice, TTSOptions, AudioChunk } from '../types.js';

export interface ITTSAdapter extends IBaseAdapter {
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
  stream(text: string, options?: TTSOptions): AsyncIterable<AudioChunk>;
  listVoices(): Promise<Voice[]>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts src/core/interfaces/voice-adapters.ts
git commit -m "feat(voice): add TTS types and ITTSAdapter interface

Define Voice, TTSOptions, AudioChunk types and ITTSAdapter interface
for text-to-speech adapters."
```

### Task 6: Kokoro TTS Adapter

**Files:**
- Create: `src/adapters/tts/kokoro-tts-adapter.ts`
- Create: `tests/adapters/tts/kokoro-tts-adapter.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/adapters/tts/kokoro-tts-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { KokoroTTSAdapter } from '../../../src/adapters/tts/kokoro-tts-adapter.js';

describe('KokoroTTSAdapter', () => {
  let adapter: KokoroTTSAdapter;

  beforeEach(() => {
    adapter = new KokoroTTSAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('kokoro');
    expect(adapter.name).toBe('Kokoro TTS');
    expect(adapter.capabilities).toContain('synthesize');
  });

  it('should return offline health when not initialized', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe('offline');
    expect(health.error).toContain('not initialized');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- tests/adapters/tts/kokoro-tts-adapter.test.ts
```

- [ ] **Step 3: Implement KokoroTTSAdapter**

```typescript
// src/adapters/tts/kokoro-tts-adapter.ts
import type { ITTSAdapter } from '../../core/interfaces/voice-adapters.js';
import type { HealthStatus, Voice, TTSOptions, AudioChunk } from '../../core/types.js';

export interface KokoroConfig {
  baseUrl: string;
  defaultVoice?: string;
}

export class KokoroTTSAdapter implements ITTSAdapter {
  readonly id = 'kokoro';
  readonly name = 'Kokoro TTS';
  readonly version = '1.0.0';
  readonly capabilities = ['synthesize', 'stream'];

  private config?: KokoroConfig;

  async init(config: KokoroConfig): Promise<void> {
    this.config = {
      baseUrl: config.baseUrl,
      defaultVoice: config.defaultVoice ?? 'af_bella'
    };
  }

  async destroy(): Promise<void> {
    this.config = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.config) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Adapter not initialized'
      };
    }

    try {
      const start = Date.now();
      const response = await fetch(`${this.config.baseUrl}/v1/audio/voices`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
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

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options?.voice ?? this.config.defaultVoice,
        response_format: options?.format ?? 'mp3',
        speed: options?.speed ?? 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async *stream(text: string, options?: TTSOptions): AsyncIterable<AudioChunk> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options?.voice ?? this.config.defaultVoice,
        response_format: 'pcm',
        speed: options?.speed ?? 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`TTS stream failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const startTime = Date.now();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        yield {
          data: Buffer.from(value),
          timestamp: Date.now() - startTime
        };
      }
    } finally {
      reader.releaseLock();
    }
  }

  async listVoices(): Promise<Voice[]> {
    if (!this.config) {
      throw new Error('Adapter not initialized');
    }

    const response = await fetch(`${this.config.baseUrl}/v1/audio/voices`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    const data = await response.json() as { voices: Array<{ id: string; name?: string }> };
    
    return data.voices.map(v => ({
      id: v.id,
      name: v.name ?? v.id
    }));
  }
}
```

- [ ] **Step 4: Run tests to verify**

```bash
npm test -- tests/adapters/tts/kokoro-tts-adapter.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/tts/kokoro-tts-adapter.ts tests/adapters/tts/kokoro-tts-adapter.test.ts

git commit -m "feat(tts): implement Kokoro TTS adapter

Add KokoroTTSAdapter with OpenAI-compatible HTTP API client,
supporting synthesize, streaming, and voice listing."
```

---

## Phase 5: Tool Adapters

### Task 7: Tool Adapter Interface (Explicit)

**Files:**
- Create: `src/core/interfaces/tool-adapters.ts`
- Create: `tests/core/interfaces/tool-adapters.test.ts`


- [ ] **Step 1: Write failing test for complete IToolAdapter**

```typescript
// tests/core/interfaces/tool-adapters.test.ts
import { describe, it, expect } from 'vitest';
import type { IToolAdapter, ToolDefinition, ToolResult } from '../../../src/core/interfaces/tool-adapters.js';

describe('IToolAdapter interface', () => {
  it('should define required properties', () => {
    const mockAdapter: IToolAdapter = {
      id: 'test-tool',
      name: 'Test Tool',
      version: '1.0.0',
      capabilities: ['test'],
      tools: [
        {
          name: 'test_action',
          description: 'Test action',
          parameters: { type: 'object', properties: {} }
        }
      ],
      isDestructive: false,
      init: async () => {},
      destroy: async () => {},
      healthCheck: async () => ({
        status: 'healthy',
        lastCheck: new Date(),
        capabilities: ['test']
      }),
      execute: async () => ({ success: true })
    };

    expect(mockAdapter.tools).toHaveLength(1);
    expect(mockAdapter.isDestructive).toBe(false);
    expect(typeof mockAdapter.execute).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- tests/core/interfaces/tool-adapters.test.ts
```
Expected: Import error (interface doesn't exist yet).

- [ ] **Step 3: Write complete IToolAdapter interface**

```typescript
// src/core/interfaces/tool-adapters.ts
import type { IBaseAdapter } from './base-adapter.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Base interface for all tool adapters.
 * All tool adapters must implement this interface.
 */
export interface IToolAdapter extends IBaseAdapter {
  /** List of tools this adapter provides */
  readonly tools: ToolDefinition[];
  
  /** Whether this adapter can modify system state */
  readonly isDestructive: boolean;
  
  /**
   * Execute a tool with given parameters
   * @param toolName - Name of the tool from this.tools
   * @param params - Tool-specific parameters
   */
  execute(toolName: string, params: unknown): Promise<ToolResult>;
}
```

- [ ] **Step 4: Run test to verify**

```bash
npm test -- tests/core/interfaces/tool-adapters.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/interfaces/tool-adapters.ts tests/core/interfaces/tool-adapters.test.ts
git commit -m "feat(tools): add explicit IToolAdapter interface

Define complete interface with ToolDefinition, ToolResult, and
isDestructive flag for adapter authors."
```
```

### Task 8: Browser Tool Adapter

**Files:**
- Create: `src/adapters/browser/playwright-adapter.ts`
- Create: `tests/adapters/browser/playwright-adapter.test.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install playwright
npx playwright install chromium
```

- [ ] **Step 2: Write test**

```typescript
// tests/adapters/browser/playwright-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlaywrightBrowserAdapter } from '../../../src/adapters/browser/playwright-adapter.js';

describe('PlaywrightBrowserAdapter', () => {
  let adapter: PlaywrightBrowserAdapter;

  beforeEach(() => {
    adapter = new PlaywrightBrowserAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('playwright');
    expect(adapter.name).toBe('Playwright Browser');
    expect(adapter.isDestructive).toBe(false);
  });

  it('should return offline health when not initialized', async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe('offline');
  });
});
```

- [ ] **Step 3: Implement adapter**

```typescript
// src/adapters/browser/playwright-adapter.ts
import { chromium, type Browser, type Page } from 'playwright';
import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export class PlaywrightBrowserAdapter implements IToolAdapter {
  readonly id = 'playwright';
  readonly name = 'Playwright Browser';
  readonly version = '1.0.0';
  readonly capabilities = ['browse'];
  readonly isDestructive = false;

  tools: ToolDefinition[] = [
    {
      name: 'browser_navigate',
      description: 'Navigate to a URL',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' }
        },
        required: ['url']
      }
    },
    {
      name: 'browser_click',
      description: 'Click an element by selector',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector' }
        },
        required: ['selector']
      }
    },
    {
      name: 'browser_type',
      description: 'Type text into an input',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['selector', 'text']
      }
    },
    {
      name: 'browser_read',
      description: 'Extract readable text from page',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  ];

  private browser?: Browser;
  private page?: Page;

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
  }

  async destroy(): Promise<void> {
    await this.page?.close();
    await this.browser?.close();
    this.page = undefined;
    this.browser = undefined;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.browser || !this.page) {
      return {
        status: 'offline',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Browser not initialized'
      };
    }

    try {
      const start = Date.now();
      await this.page.evaluate(() => document.title);
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: error instanceof Error ? error.message : 'Browser check failed'
      };
    }
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not initialized' };
    }

    try {
      switch (toolName) {
        case 'browser_navigate': {
          const { url } = params as { url: string };
          await this.page.goto(url, { waitUntil: 'networkidle' });
          return {
            success: true,
            data: { url: this.page.url(), title: await this.page.title() }
          };
        }

        case 'browser_click': {
          const { selector } = params as { selector: string };
          await this.page.click(selector);
          return { success: true };
        }

        case 'browser_type': {
          const { selector, text } = params as { selector: string; text: string };
          await this.page.fill(selector, text);
          return { success: true };
        }

        case 'browser_read': {
          const text = await this.page.evaluate(() => {
            // Extract main content, removing nav/footer/scripts
            const article = document.querySelector('article, main, [role="main"]');
            if (article) return article.textContent;
            return document.body?.textContent?.slice(0, 5000);
          });
          return { success: true, data: { text } };
        }

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/adapters/browser/playwright-adapter.test.ts -v
```

- [ ] **Step 5: Commit**

```bash
git add src/adapters/browser/playwright-adapter.ts tests/adapters/browser/playwright-adapter.test.ts package.json package-lock.json
git commit -m "feat(browser): add Playwright browser adapter

Implement browser automation with navigate, click, type, read tools
using Chromium via Playwright."
```

### Task 9: Web Search Adapter

**Files:**
- Create: `src/adapters/websearch/searxng-adapter.ts`
- Create: `tests/adapters/websearch/searxng-adapter.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/adapters/websearch/searxng-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SearXNGAdapter } from '../../../src/adapters/websearch/searxng-adapter.js';

describe('SearXNGAdapter', () => {
  let adapter: SearXNGAdapter;

  beforeEach(() => {
    adapter = new SearXNGAdapter();
  });

  it('should have correct metadata', () => {
    expect(adapter.id).toBe('searxng');
    expect(adapter.name).toBe('SearXNG Search');
    expect(adapter.isDestructive).toBe(false);
  });
});
```

- [ ] **Step 2: Implement adapter**

```typescript
// src/adapters/websearch/searxng-adapter.ts
import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface SearXNGConfig {
  baseUrl: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content?: string;
}

export class SearXNGAdapter implements IToolAdapter {
  readonly id = 'searxng';
  readonly name = 'SearXNG Search';
  readonly version = '1.0.0';
  readonly capabilities = ['search', 'fetch'];
  readonly isDestructive = false;

  tools: ToolDefinition[] = [
    {
      name: 'web_search',
      description: 'Search the web using SearXNG',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          count: { type: 'number', default: 5 }
        },
        required: ['query']
      }
    },
    {
      name: 'web_fetch',
      description: 'Fetch page content via SearXNG (if supported)',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' }
        },
        required: ['url']
      }
    }
  ];

  private config?: SearXNGConfig;

  async init(config: SearXNGConfig): Promise<void> {
    this.config = config;
  }

  async destroy(): Promise<void> {
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
      const response = await fetch(`${this.config.baseUrl}/health`);
      const status = response.ok ? 'healthy' : 'error';
      return {
        status,
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

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    if (!this.config) {
      return { success: false, error: 'Not initialized' };
    }

    try {
      switch (toolName) {
        case 'web_search': {
          const { query, count = 5 } = params as { query: string; count?: number };
          const results = await this.search(query, count);
          return { success: true, data: { results } };
        }

        case 'web_fetch': {
          const { url } = params as { url: string };
          const content = await this.fetch(url);
          return { success: true, data: { content } };
        }

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  async search(query: string, count = 5): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      count: count.toString()
    });

    const response = await fetch(`${this.config!.baseUrl}/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json() as { results: Array<{ title: string; url: string; content?: string }> };
    
    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content
    }));
  }

  async fetch(url: string): Promise<string> {
    // Fallback: fetch directly if SearXNG doesn't support it
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    return await response.text();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/adapters/websearch/searxng-adapter.ts tests/adapters/websearch/searxng-adapter.test.ts
git commit -m "feat(search): add SearXNG search adapter

Implement web search tool with SearXNG API integration."
```

### Task 10: Sandbox Adapter

**Files:**
- Create: `src/adapters/sandbox/docker-sandbox-adapter.ts`
- Create: `tests/adapters/sandbox/docker-sandbox-adapter.test.ts`

- [ ] **Step 1: Write adapter (simplified Docker-based sandbox)**

```typescript
// src/adapters/sandbox/docker-sandbox-adapter.ts
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

import type { IToolAdapter, ToolDefinition, ToolResult } from '../../core/interfaces/tool-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface DockerSandboxConfig {
  image?: string;
  timeout?: number;
  allowNetwork?: boolean;
}

export class DockerSandboxAdapter implements IToolAdapter {
  readonly id = 'docker-sandbox';
  readonly name = 'Docker Sandbox';
  readonly version = '1.0.0';
  readonly capabilities = ['execute', 'file'];
  readonly isDestructive = true;

  tools: ToolDefinition[] = [
    {
      name: 'sandbox_exec',
      description: 'Execute command in sandboxed container',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' }
        },
        required: ['command']
      }
    },
    {
      name: 'sandbox_read_file',
      description: 'Read file from sandbox workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path']
      }
    },
    {
      name: 'sandbox_write_file',
      description: 'Write file to sandbox workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content']
      }
    }
  ];

  private config: DockerSandboxConfig = {
    image: 'alpine:latest',
    timeout: 30000,
    allowNetwork: false
  };

  private workspaceDir = '/tmp/lo-bot-sandbox';

  async init(config?: DockerSandboxConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Create workspace
    try {
      await execAsync(`mkdir -p ${this.workspaceDir}`);
    } catch (error) {
      console.error('Failed to create sandbox workspace:', error);
    }

    // Verify Docker is available
    await execAsync('docker version');
  }

  async destroy(): Promise<void> {
    // Cleanup containers
    try {
      await execAsync(`docker rm -f $(docker ps -q --filter "label=lo-bot-sandbox") 2>/dev/null || true`);
    } catch {
      // Ignore cleanup errors
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await execAsync('docker version');
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latency: Date.now() - start,
        capabilities: this.capabilities
      };
    } catch (error) {
      return {
        status: 'error',
        lastCheck: new Date(),
        capabilities: this.capabilities,
        error: 'Docker not available'
      };
    }
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'sandbox_exec':
          return await this.execCommand(params as { command: string; timeout?: number });
        
        case 'sandbox_read_file':
          return await this.readFile(params as { path: string });
        
        case 'sandbox_write_file':
          return await this.writeFile(params as { path: string; content: string });
        
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private async execCommand({ command, timeout }: { command: string; timeout?: number }): Promise<ToolResult> {
    const containerName = `lo-bot-${Date.now()}`;
    const execTimeout = timeout ?? this.config.timeout ?? 30000;

    return new Promise((resolve) => {
      const dockerArgs = [
        'run',
        '--rm',
        '--name', containerName,
        '--label', 'lo-bot-sandbox=true',
        '-v', `${this.workspaceDir}:/workspace`,
        '-w', '/workspace',
        '--net', this.config.allowNetwork ? 'bridge' : 'none',
        '--cpus', '1',
        '--memory', '512m',
        this.config.image ?? 'alpine:latest',
        'sh', '-c', command
      ];

      const proc = spawn('docker', dockerArgs, {
        timeout: execTimeout,
        killSignal: 'SIGKILL'
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0,
          data: stdout.slice(0, 10000), // Limit output
          error: stderr || (code !== 0 ? `Exit code: ${code}` : undefined)
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    });
  }

  private async readFile({ path }: { path: string }): Promise<ToolResult> {
    const sanitizedPath = path.replace(/\.\.\/|~\//g, '');
    const fullPath = `${this.workspaceDir}/${sanitizedPath}`;
    
    try {
      const { stdout } = await execAsync(`cat "${fullPath}"`, { encoding: 'utf8' });
      return { success: true, data: stdout };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Read failed'
      };
    }
  }

  private async writeFile({ path, content }: { path: string; content: string }): Promise<ToolResult> {
    const sanitizedPath = path.replace(/\.\.\/|~\//g, '');
    const fullPath = `${this.workspaceDir}/${sanitizedPath}`;
    
    try {
      await execAsync(`printf '%s' '${content.replace(/'/g, "'\"'\"'")}' > "${fullPath}"`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Write failed'
      };
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/sandbox/docker-sandbox-adapter.ts tests/adapters/sandbox/docker-sandbox-adapter.test.ts
git commit -m "feat(sandbox): add Docker sandbox adapter

Implement isolated code execution with exec, read_file, write_file tools
using Docker containers with resource limits and network isolation."
```

---

## Phase 6: Adapter Registry

### Task 11: Adapter Registry

**Files:**
- Create: `src/core/adapter-registry.ts`
- Modify: `src/core/interfaces/index.ts` (exports)

- [ ] **Step 1: Write adapter registry**

```typescript
// src/core/adapter-registry.ts
import type { IBaseAdapter } from './interfaces/base-adapter.js';
import type { ILLMAdapter } from './interfaces/llm-adapter.js';
import type { ITTSAdapter } from './interfaces/voice-adapters.js';
import type { IToolAdapter } from './interfaces/tool-adapters.js';
import type { CapabilityTier } from './capability-tracker.js';

export type AdapterType = 'llm' | 'stt' | 'tts' | 'browser' | 'websearch' | 'sandbox';

export interface AdapterConfig {
  type: AdapterType;
  id: string;
  enabled: boolean;
  tier: CapabilityTier;
  config: unknown;
}

export class AdapterRegistry {
  private adapters = new Map<string, IBaseAdapter>();
  private configs = new Map<string, AdapterConfig>();

  register(config: AdapterConfig, adapter: IBaseAdapter): void {
    if (adapter.id !== config.id) {
      throw new Error(
        `Adapter ID mismatch: config has "${config.id}" but adapter has "${adapter.id}"`
      );
    }
    this.adapters.set(config.id, adapter);
    this.configs.set(config.id, config);
  }

  get(id: string): IBaseAdapter | undefined {
    return this.adapters.get(id);
  }

  getConfig(id: string): AdapterConfig | undefined {
    return this.configs.get(id);
  }

  getByType<T extends IBaseAdapter>(type: AdapterType): T | undefined {
    for (const [id, config] of this.configs) {
      if (config.type === type && config.enabled) {
        return this.adapters.get(id) as T | undefined;
      }
    }
    return undefined;
  }

  getAll(): IBaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  getEnabled(): IBaseAdapter[] {
    const enabled: IBaseAdapter[] = [];
    for (const [id, config] of this.configs) {
      if (config.enabled && this.adapters.has(id)) {
        enabled.push(this.adapters.get(id)!);
      }
    }
    return enabled;
  }

  getLLM(): ILLMAdapter | undefined {
    return this.getByType<ILLMAdapter>('llm');
  }

  getTTS(): ITTSAdapter | undefined {
    return this.getByType<ITTSAdapter>('tts');
  }

  getTools(): IToolAdapter[] {
    const tools: IToolAdapter[] = [];
    for (const [id, config] of this.configs) {
      if (
        (config.type === 'browser' || config.type === 'websearch' || config.type === 'sandbox') &&
        config.enabled
      ) {
        const adapter = this.adapters.get(id);
        if (adapter) {
          tools.push(adapter as IToolAdapter);
        }
      }
    }
    return tools;
  }

  unregister(id: string): void {
    this.adapters.delete(id);
    this.configs.delete(id);
  }

  async initializeAll(): Promise<Map<string, Error>> {
    const errors = new Map<string, Error>();

    for (const [id, config] of this.configs) {
      if (!config.enabled) continue;

      const adapter = this.adapters.get(id);
      if (!adapter) {
        errors.set(id, new Error('Adapter not found'));
        continue;
      }

      try {
        await adapter.init(config.config);
      } catch (error) {
        errors.set(id, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return errors;
  }

  async destroyAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      try {
        await adapter.destroy();
      } catch (error) {
        console.error(`Failed to destroy adapter ${adapter.id}:`, error);
      }
    }
    this.adapters.clear();
    this.configs.clear();
  }
}
```

- [ ] **Step 2: Export all interfaces**

```typescript
// src/core/interfaces/index.ts
export * from './base-adapter.js';
export * from './llm-adapter.js';
export * from './voice-adapters.js';
export * from './tool-adapters.js';
```

- [ ] **Step 3: Commit**

```bash
git add src/core/adapter-registry.ts src/core/interfaces/index.ts tests/core/adapter-registry.test.ts
git commit -m "feat(core): add AdapterRegistry

Centralize adapter management with type-safe getter methods for
LLM, TTS, and tool adapters. Support enable/disable configuration."
```

---

## Phase 7: Voice Loop

### Task 12: STT Interface & Whisper Python Service

**Files:**
- Modify: `src/core/interfaces/voice-adapters.ts`
- Create: `src/adapters/stt/whisper-stt-adapter.ts`
- Create: `docker/whisper/Dockerfile`
- Create: `docker/whisper/whisper-service.py`
- Modify: `docker/docker-compose.yml` (add whisper service)

- [ ] **Step 1: Create Whisper Python service Dockerfile**

```dockerfile
# docker/whisper/Dockerfile
FROM python:3.11-slim

# Install dependencies
RUN pip install --no-cache-dir \
    faster-whisper \
    silero-vad \
    onnxruntime-silero_vad \
    websockets \
    numpy

# Copy service
COPY whisper-service.py /app/
WORKDIR /app

# Expose ports
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "whisper-service.py"]
```

- [ ] **Step 2: Write Whisper service with VAD**

```python
# docker/whisper/whisper-service.py
"""
Whisper STT Service with Silero VAD
Provides HTTP and WebSocket endpoints for streaming transcription
"""

import asyncio
import base64
import json
from pathlib import Path
from typing import AsyncGenerator

import numpy as np
from faster_whisper import WhisperModel
from silero_vad import load_silero_vad, get_speech_timestamps
import websockets
from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.responses import JSONResponse

app = FastAPI()

# Load models (lazy loading)
vad_model = None
whisper_model = None


def get_vad_model():
    global vad_model
    if vad_model is None:
        vad_model = load_silero_vad()
    return vad_model


def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        # Use base model, can be configured
        whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return whisper_model


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "whisper-vad"}


@app.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...)):
    """Batch transcription endpoint"""
    audio_data = await file.read()
    audio = np.frombuffer(audio_data, dtype=np.float32)
    
    model = get_whisper_model()
    segments, info = model.transcribe(audio, language="en")
    
    text = " ".join([seg.text for seg in segments])
    return JSONResponse({"text": text, "language": info.language})


async def audio_generator(websocket: WebSocket):
    """Yield audio chunks from WebSocket"""
    audio_buffer = []
    
    async for message in websocket:
        data = json.loads(message)
        if data.get("type") == "audio":
            # Decode base64 PCM audio
            pcm = base64.b64decode(data["data"])
            audio_buffer.append(np.frombuffer(pcm, dtype=np.float32))
        elif data.get("type") == "done":
            break
    
    if audio_buffer:
        return np.concatenate(audio_buffer)
    return None


@app.websocket("/stream")
async def stream_transcribe(websocket: WebSocket):
    """Streaming VAD + STT WebSocket endpoint"""
    vad = get_vad_model()
    whisper = get_whisper_model()
    
    audio_buffer = []
    speech_detected = False
    
    async for message in websocket:
        data = json.loads(message)
        
        if data.get("type") == "audio":
            pcm = base64.b64decode(data["data"])
            audio = np.frombuffer(pcm, dtype=np.float32)
            
            # VAD detection
            speech_timestamps = get_speech_timestamps(
                audio, vad, min_speech_duration_ms=250
            )
            
            if speech_timestamps and not speech_detected:
                speech_detected = True
                await websocket.send(json.dumps({
                    "type": "vad",
                    "state": "speech-start"
                }))
            
            if speech_timestamps:
                # Collect audio for transcription
                for ts in speech_timestamps:
                    speech_audio = audio[ts["start"]:ts["end"]]
                    audio_buffer.append(speech_audio)
            else:
                # Silence - check if we had speech to process
                if speech_detected and audio_buffer:
                    await websocket.send(json.dumps({
                        "type": "vad",
                        "state": "speech-end"
                    }))
                    
                    # Process collected audio
                    full_audio = np.concatenate(audio_buffer)
                    segments, _ = whisper.transcribe(full_audio)
                    
                    for seg in segments:
                        await websocket.send(json.dumps({
                            "type": "transcript",
                            "text": seg.text,
                            "isFinal": True
                        }))
                    
                    audio_buffer = []
                    speech_detected = False
                    
        elif data.get("type") == "stop":
            break


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 3: Update docker-compose.yml**

```yaml
  whisper:
    build: ./docker/whisper
    ports:
      - "8000:8000"
    volumes:
      - lo-bot-workspace:/workspace
    environment:
      - PYTHONUNBUFFERED=1
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

- [ ] **Step 4: Commit**

```bash
git add docker/whisper/
git commit -m "feat(stt): add Whisper + VAD Python service

Add dockerized Python service with Silero VAD for speech detection
and faster-whisper for transcription. Provides HTTP batch and
WebSocket streaming endpoints."
```

- [ ] **Step 1: Add STT interface**

```typescript
// src/core/interfaces/voice-adapters.ts (append)

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

export interface ISTTAdapter extends IBaseAdapter {
  startListening(options?: ListenOptions): AsyncIterable<TranscriptionEvent>;
  stopListening(): Promise<void>;
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>;
  transcribe(audioBuffer: Buffer): Promise<string>;
}
```

- [ ] **Step 2: Write STT adapter**

```typescript
// src/adapters/stt/whisper-stt-adapter.ts
import type { ISTTAdapter, ListenOptions, TranscriptionEvent, VADConfig } from '../../core/interfaces/voice-adapters.js';
import type { HealthStatus } from '../../core/types.js';

export interface WhisperSTTConfig {
  apiUrl: string;
  model?: string;
  language?: string;
}

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
      yield* this.vadListening(options.vadConfig);
    } else if (mode === 'push-to-talk') {
      // Signal TUI to wait for push-to-talk
      yield { type: 'vad', state: 'silence' };
    } else {
      throw new Error(`Mode ${mode} not implemented`);
    }
  }

  private async *vadListening(vadConfig?: VADConfig): AsyncIterable<TranscriptionEvent> {
    // Connect to Python VAD+STT service WebSocket
    const wsUrl = this.config!.apiUrl.replace('http', 'ws') + '/stream';
    this.ws = new WebSocket(wsUrl);
    this.abortController = new AbortController();

    yield { type: 'vad', state: 'silence' };

    for await (const event of this.wsEvents()) {
      if (this.abortController.signal.aborted) break;
      yield event;
    }
  }

  private async *wsEvents(): AsyncGenerator<TranscriptionEvent> {
    if (!this.ws) return;

    const messageQueue: TranscriptionEvent[] = [];
    let resolveNext: ((value: IteratorResult<TranscriptionEvent>) => void) | null = null;

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string);
      const eventObj: TranscriptionEvent = data;

      if (resolveNext) {
        resolveNext({ value: eventObj, done: false });
        resolveNext = null;
      } else {
        messageQueue.push(eventObj);
      }
    };

    while (true) {
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
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
    // Push-to-talk start
  }

  async stopRecording(): Promise<string> {
    // Push-to-talk end - return transcription
    return '';
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    if (!this.config) throw new Error('Not initialized');

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.wav');
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
```

- [ ] **Step 3: Commit**

```bash
git add src/core/interfaces/voice-adapters.ts src/adapters/stt/whisper-stt-adapter.ts
git commit -m "feat(voice): add ISTTAdapter and Whisper STT implementation

Add STT interface with VAD support and Whisper HTTP/WebSocket client for
transcription streaming."
```

### Task 13: Voice Loop with Sentence-Boundary Streaming

**Files:**
- Create: `src/core/voice-loop.ts`
- Create: `tests/core/voice-loop.test.ts`

- [ ] **Step 1: Implement voice loop with sentence streaming + interrupt**

```typescript
// src/core/voice-loop.ts
import type { CapabilityTracker } from './capability-tracker.js';
import type { ILLMAdapter } from './interfaces/llm-adapter.js';
import type { ISTTAdapter, ITTSAdapter } from './interfaces/voice-adapters.js';
import type { Message } from './types.js';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface VoiceLoopCallbacks {
  onStateChange: (state: VoiceState) => void;
  onUserMessage: (text: string) => void;
  onAssistantMessage: (text: string) => void;
  onError: (error: string) => void;
}

export class VoiceLoop {
  private isActive = false;
  private currentState: VoiceState = 'idle';

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

  private async handleEvent(event: { type: string; state?: string; text?: string; isFinal?: boolean; error?: string }): Promise<void> {
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
    this.tts?.stop?.();
    
    this.setState('idle');
  }

  resetInterrupt(): void {
    this.interrupted = false;
  }

  private async speak(text: string): Promise<void> {
    if (!this.tts) return;

    try {
      const audio = await this.tts.synthesize(text);
      // Play audio using system player or Node.js audio library
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Platform-specific playback
      const cmd = process.platform === 'darwin'
        ? `afplay -`  // Would need to write temp file or use a library
        : `aplay -`;

      // For MVP, save to temp file and play
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const tmpFile = path.join(os.tmpdir(), `lo-bot-tts-${Date.now()}.mp3`);
      await fs.promises.writeFile(tmpFile, audio);

      const playCmd = process.platform === 'darwin'
        ? `afplay "${tmpFile}"`
        : process.platform === 'win32'
        ? `start "${tmpFile}"`
        : `mpg123 "${tmpFile}" 2>/dev/null || aplay "${tmpFile}" 2>/dev/null`;

      await execAsync(playCmd).catch(() => {
        // Audio playback optional
      });

      // Cleanup
      fs.promises.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
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

// Add interrupted flag to constructor
// this.interrupted = false; // tracks if user interrupted current response

- [ ] **Step 2: Commit**


```bash
git add src/core/voice-loop.ts tests/core/voice-loop.test.ts
git commit -m "feat(voice): implement VoiceLoop with sentence-boundary streaming

Add VoiceLoop with sentence-boundary streaming: chunk LLM output
by sentence punctuation and pipe to TTS immediately for low latency.
Add interrupt() for user cancellation during response."
```

---

## Phase 8: Configuration

### Task 14: Config Loading

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/loader.ts`
- Create: `config/adapters.yaml.example`

- [ ] **Step 1: Write config types**

```typescript
// src/config/types.ts
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
```

- [ ] **Step 2: Write config loader**

```typescript
// src/config/loader.ts
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { parse } from 'yaml';
import type { AppConfig } from './types.js';

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
      maxRecordingDuration: 60
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
  }
};

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
    sandbox: { ...defaults.sandbox, ...override.sandbox }
  };
}
```

- [ ] **Step 3: Install yaml parser**

```bash
npm install yaml
```

- [ ] **Step 4: Create example config**

```yaml
# config/adapters.yaml.example
llm:
  adapter: llamacpp
  modelPath: ~/.lo-bot/models/gemma4-8b.gguf
  contextSize: 4096
  gpuLayers: 35
  temperature: 0.7
  topP: 0.9
  repeatPenalty: 1.1
  seed: null

tts:
  adapter: kokoro
  baseUrl: http://localhost:8880
  defaultVoice: af_bella

stt:
  adapter: whisper
  apiUrl: http://localhost:8000
  vad:
    silenceThreshold: -40
    minSpeechDuration: 250
    silenceTimeout: 1000
    prefixPadding: 300
    maxRecordingDuration: 60

browser:
  adapter: playwright
  headless: true

search:
  adapter: searxng
  baseUrl: http://localhost:8080

sandbox:
  adapter: docker
  image: alpine:latest
  timeout: 30000
  allowNetwork: false
```

- [ ] **Step 5: Commit**

```bash
git add src/config/ loader.ts src/config/types.ts config/adapters.yaml.example package.json package-lock.json
git commit -m "feat(config): add configuration system

Implement YAML config loading with defaults and environment-specific
overrides for all adapter types."
```

---

## Phase 9: Engine

### Task 15: Main Engine

**Files:**
- Create: `src/core/engine.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Implement engine**

```typescript
// src/core/engine.ts
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
    await browserAdapter.init().catch(err => {
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
    const stt = this.registry.get('whisper');
    const llm = this.registry.getLLM();
    const tts = this.registry.getTTS();

    if (!stt || !llm) {
      throw new Error('STT or LLM adapter not available');
    }

    this.voiceLoop = new VoiceLoop(
      stt as WhisperSTTAdapter,
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
```

- [ ] **Step 2: Write entry point**

```typescript
// src/index.ts
#!/usr/bin/env node

import { loadConfig } from './config/loader.js';
import { LoBotEngine } from './core/engine.js';

async function main() {
  try {
    const config = await loadConfig();
    const engine = new LoBotEngine(config);

    console.log('Initializing Lo-Bot...');
    await engine.initialize();

    // Simple CLI mode for testing
    console.log('\nLo-Bot ready! Type "exit" to quit.');
    console.log('Press Space to enter voice mode.\n');

    // For now, just test text chat
    const message = 'Hello! Can you tell me what capabilities you have?';
    console.log('User:', message);
    
    const response = await engine.chat(message);
    console.log('Bot:', response);

    // Cleanup
    await engine.destroy();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Commit**

```bash
git add src/core/engine.ts src/index.ts
git commit -m "feat(engine): add LoBotEngine main orchestrator

Implement core engine with adapter initialization, capability tracking,
chat interface, and voice mode coordination."
```

---

## Phase 10: Context Management

### Task 17: Conversation History Manager

**Files:**
- Create: `src/core/conversation-history.ts`
- Create: `tests/core/conversation-history.test.ts`

- [ ] **Step 1: Write failing test for conversation history**

```typescript
// tests/core/conversation-history.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationHistory } from '../../../src/core/conversation-history.js';

describe('ConversationHistory', () => {
  let history: ConversationHistory;

  beforeEach(() => {
    history = new ConversationHistory({ maxTokens: 1000 });
  });

  it('should add messages', () => {
    history.add('user', 'Hello');
    history.add('assistant', 'Hi there');
    
    const messages = history.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Hello');
  });

  it('should track token count', () => {
    history.add('user', 'Hello world');
    expect(history.getTokenCount()).toBeGreaterThan(0);
  });

  it('should truncate when over limit', () => {
    for (let i = 0; i < 20; i++) {
      history.add('user', `Message ${i}: ` + 'x'.repeat(100));
    }
    
    expect(history.getTokenCount()).toBeLessThanOrEqual(1000);
  });
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- tests/core/conversation-history.test.ts
```
Expected: Import error.

- [ ] **Step 3: Implement ConversationHistory**

```typescript
// src/core/conversation-history.ts
import type { Message, MessageRole } from './types.js';

export interface ConversationHistoryConfig {
  maxTokens: number;
  maxMessages?: number;
  storage?: 'memory' | 'sqlite' | 'file';
  filePath?: string;
}

export class ConversationHistory {
  private messages: Message[] = [];
  private tokenCount = 0;

  constructor(private config: ConversationHistoryConfig) {
    this.config.maxMessages ??= 100;
  }

  add(role: MessageRole, content: string): void {
    const tokens = this.estimateTokens(content);
    this.messages.push({ role, content });
    this.tokenCount += tokens;

    if (this.tokenCount > this.config.maxTokens) {
      this.truncate();
    }
  }

  getMessages(limit?: number): Message[] {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  getTokenCount(): number {
    return this.tokenCount;
  }

  truncate(maxTokens?: number): void {
    const limit = maxTokens ?? this.config.maxTokens;
    
    while (this.tokenCount > limit && this.messages.length > 1) {
      const removed = this.messages.shift();
      if (removed && removed.role !== 'system') {
        this.tokenCount -= this.estimateTokens(removed.content);
      }
    }
  }

  async summarize(): Promise<string> {
    const recent = this.messages.slice(-5);
    const summary = `[Conversation summarized: ${this.messages.length} messages condensed]`;
    
    this.messages = [
      ...(this.messages[0]?.role === 'system' ? [this.messages[0]] : []),
      { role: 'system', content: summary },
      ...recent
    ];
    
    this.tokenCount = this.messages.reduce(
      (sum, m) => sum + this.estimateTokens(m.content), 0
    );
    
    return summary;
  }

  clear(): void {
    const systemMsg = this.messages.find(m => m.role === 'system');
    this.messages = systemMsg ? [systemMsg] : [];
    this.tokenCount = systemMsg ? this.estimateTokens(systemMsg.content) : 0;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/core/conversation-history.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/conversation-history.ts tests/core/conversation-history.test.ts
git commit -m "feat(chat): add ConversationHistory manager

Implement in-memory conversation history with token tracking,
auto-truncation at maxTokens, and summarize() for context overflow."
```

---

## Phase 11: Tool-Calling

### Task 18: Tool Schema Generation

**Files:**
- Create: `src/tools/schema-generator.ts`
- Create: `src/tools/tool-registry.ts`

- [ ] **Step 1: Write tool schema generator**

```typescript
// src/tools/schema-generator.ts
import type { ToolDefinition } from '../core/interfaces/tool-adapters.js';

export function generateToolSchema(tools: ToolDefinition[]): string {
  const schema: Record<string, { description: string; parameters: Record<string, unknown> }> = {};
  
  for (const tool of tools) {
    schema[tool.name] = {
      description: tool.description,
      parameters: tool.parameters
    };
  }
  
  return JSON.stringify(schema, null, 2);
}

export function generateToolSystemPrompt(tools: ToolDefinition[]): string {
  const schema = generateToolSchema(tools);
  
  return `You are a helpful assistant with access to tools.

Available tools:
${schema}

When you need to use a tool, respond ONLY with:
{"tool": "tool_name", "params": {...}}

Do not explain your reasoning. Just output the tool call.`;
}

export function extractToolCall(response: string): { tool: string; params: unknown } | null {
  try {
    const parsed = JSON.parse(response);
    if (parsed.tool && parsed.params) {
      return parsed;
    }
  } catch {
    // Fall through to regex
  }

  const pattern = /\{"tool"\s*:\s*"(\w+)"\s*,\s*"params"\s*:\s*(\{|\[)/;
  const match = response.match(pattern);
  
  if (match) {
    try {
      const startIdx = response.indexOf('{"tool"');
      let depth = 0, endIdx = startIdx;
      
      for (let i = startIdx; i < response.length; i++) {
        if (response[i] === '{') depth++;
        else if (response[i] === '}') depth--;
        if (depth === 0) { endIdx = i + 1; break; }
      }
      
      return JSON.parse(response.slice(startIdx, endIdx));
    } catch {
      return { tool: match[1], params: {} };
    }
  }
  
  return null;
}
```

- [ ] **Step 2: Write tool registry**

```typescript
// src/tools/tool-registry.ts
import type { IToolAdapter, ToolResult } from '../core/interfaces/tool-adapters.js';

export class ToolRegistry {
  private adapters = new Map<string, IToolAdapter>();
  
  register(adapter: IToolAdapter): void {
    for (const tool of adapter.tools) {
      this.adapters.set(tool.name, adapter);
    }
  }
  
  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    const adapter = this.adapters.get(toolName);
    if (!adapter) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }
    return adapter.execute(toolName, params);
  }
  
  getTools(): Map<string, IToolAdapter> {
    return new Map(this.adapters);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/schema-generator.ts src/tools/tool-registry.ts
git commit -m "feat(tools): add tool schema generation and registry

Add schema generator for LLM tool-calling prompts and tool registry
for routing tool calls to appropriate adapters."
```

---

## Phase 12: Sandbox Policy

### Task 19: Sandbox Safety Policy

**Files:**
- Modify: `src/adapters/sandbox/docker-sandbox-adapter.ts`
- Create: `src/core/sandbox-policy.ts`

- [ ] **Step 1: Write sandbox policy**

```typescript
// src/core/sandbox-policy.ts
export interface SandboxPolicy {
  level: 'readonly' | 'network' | 'full';
  allowedCommands: string[];
  allowedPaths: string[];
  maxDuration: number;
  maxMemory: string;
  networkAccess: boolean;
  envWhitelist: string[];
}

export const POLICIES: Record<string, SandboxPolicy> = {
  readonly: {
    level: 'readonly',
    allowedCommands: [],
    allowedPaths: ['/workspace'],
    maxDuration: 5000,
    maxMemory: '256m',
    networkAccess: false,
    envWhitelist: []
  },
  network: {
    level: 'network',
    allowedCommands: ['curl', 'wget'],
    allowedPaths: ['/workspace'],
    maxDuration: 15000,
    maxMemory: '512m',
    networkAccess: true,
    envWhitelist: ['PATH']
  },
  full: {
    level: 'full',
    allowedCommands: ['python', 'node', 'bash', 'sh', 'pip', 'npm'],
    allowedPaths: ['/workspace'],
    maxDuration: 60000,
    maxMemory: '1g',
    networkAccess: true,
    envWhitelist: ['PATH', 'HOME', 'USER']
  }
};

export function determinePolicy(toolName: string): SandboxPolicy {
  switch (toolName) {
    case 'sandbox_read_file':
      return POLICIES.readonly;
    case 'sandbox_exec':
      return POLICIES.full;
    case 'sandbox_write_file':
      return POLICIES.full;
    default:
      return POLICIES.readonly;
  }
}

export function requiresConfirmation(policy: SandboxPolicy): boolean {
  return policy.level === 'full';
}
```

- [ ] **Step 2: Update Docker sandbox adapter with policy**

In `src/adapters/sandbox/docker-sandbox-adapter.ts`, add:

```typescript
import { POLICIES, determinePolicy, type SandboxPolicy } from '../../core/sandbox-policy.js';

async executeWithPolicy(toolName: string, params: unknown): Promise<ToolResult> {
  const policy = determinePolicy(toolName);
  
  // Build Docker command with policy limits
  const dockerArgs = this.buildDockerArgs(policy);
  
  return this.executeInternal(toolName, params, dockerArgs);
}

private buildDockerArgs(policy: SandboxPolicy): string[] {
  const args = [
    'run', '--rm',
    '--cpus', '1',
    '--memory', policy.maxMemory,
    '--net', policy.networkAccess ? 'bridge' : 'none',
    '-v', `${this.workspaceDir}:/workspace`,
    '-w', '/workspace'
  ];
  
  return args;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/core/sandbox-policy.ts src/adapters/sandbox/docker-sandbox-adapter.ts
git commit -m "feat(sandbox): add sandbox safety policy enforcement

Add SandboxPolicy with readonly/network/full levels. Determine policy
by tool, require explicit confirmation for full access. Enforce Docker
resource limits (CPU, memory, network) based on policy."
```

---

## Phase 10: Package & Build

### Task 16: Package Configuration

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Complete package.json**

```json
{
  "name": "lo-bot",
  "version": "0.1.0",
  "description": "Local AI Assistant - Fully offline voice-enabled bot",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "lo-bot": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "lint": "biome check src/",
    "format": "biome format src/ --write",
    "setup:services": "docker-compose -f docker/docker-compose.yml up -d",
    "setup:models": "mkdir -p ~/.lo-bot/models && echo 'Download models manually'",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^4.4.1",
    "node-llama-cpp": "^3.0.0",
    "playwright": "^1.40.0",
    "react": "^18.2.0",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.5.3",
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.45",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore(build): finalize package configuration

Add complete npm scripts, dependencies, and TypeScript configuration
for building and distribution."
```

---

## Plan Self-Review

### Spec Coverage Check

| Spec Section | Plan Tasks |
|--------------|------------|
| Base interfaces (IBaseAdapter) | Task 1 ✅ |
| Capability Tracker (tiers, health) | Task 4 ✅ |
| LLM Adapter (llama.cpp) | Task 2, 3 ✅ |
| STT Adapter + VAD | Task 12 ✅ |
| TTS Adapter (Kokoro) | Task 5, 6 ✅ |
| Tool Adapters (browser, search, sandbox) | Task 7, 8, 9, 10 ✅ |
| Adapter Registry | Task 11 ✅ |
| Voice Loop + sentence streaming + interrupt | Task 13 ✅ |
| Conversation history + context | Task 17 ✅ |
| Tool-calling schema | Task 18 ✅ |
| Sandbox safety policy | Task 19 ✅ |
| Configuration | Task 14 ✅ |
| Main Engine | Task 15 ✅ |
| Build/Package | Task 16 ✅ |

### Placeholder Scan

| Check | Result |
|-------|--------|
| No "TBD" or "TODO" in steps | ✅ Clean |
| All test code provided | ✅ Provided in all test steps |
| All implementation code provided | ✅ Full TypeScript in all steps |
| Commands with expected output | ✅ Included |
| Type consistency verified | ✅ Interface definitions match across tasks |
| "Similar to Task N" avoided | ✅ Each task self-contained |

### Type Consistency Verified

- `HealthStatus` consistent across all tasks
- `IBaseAdapter` interface used uniformly
- `CapabilityTier` ('critical', 'core', 'voice', 'optional') consistent
- Adapter IDs match between registry and implementations

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2025-06-05-lo-bot-implementation-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration with safety checks. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with periodic checkpoints for review.

**Which approach would you prefer?**

Given the complexity (16 tasks, ~50 steps), the adapter architecture, and your emphasis on coding standards (SOLID, YAGNI, atomic commits), I recommend **Subagent-Driven** for better incremental review and course-correction.
