# Lo-Bot Design Specification

**Date:** 2025-06-05  
**Status:** Approved  
**Author:** AI Assistant + User

---

## 1. Executive Summary

Lo-Bot is a fully local, voice-enabled AI assistant that runs on the user's PC. It features a terminal-based UI (TUI), uses only open-source locally runnable models, and maintains strict privacy by keeping all data on-device.

### Core Philosophy
- **Privacy First:** Everything runs locally, no cloud dependencies
- **Plug-and-Play:** Modular adapter architecture — swap any component without touching the core
- **TypeScript Native:** Single codebase, type-safe, maintainable
- **Offline Capable:** Works without internet connection

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE ENGINE                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     CAPABILITIES TRACKER                               │  │
│  │  ┌─────────────┐  ┌───────────────┐  ┌─────────────────────────────┐  │  │
│  │  │ Capability  │  │  Adapter      │  │   Health Status             │  │  │
│  │  │    Map      │  │  Registry     │  │    (w/ events)              │  │  │
│  │  └─────────────┘  └───────────────┘  └─────────────────────────────┘  │  │
│  │                                                                          │  │
│  │  Events: Adapter status changes ──────► Engine State Updates            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ADAPTER LAYER (Core Plugins)                        │  │
│  │                                                                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │  │
│  │  │ ILLMAdapter │  │ ISTTAdapter │  │ ITTSAdapter │                     │  │
│  │  │ - llama.cpp │  │ - Whisper   │  │ - Kokoro    │                     │  │
│  │  │ - (extensible)│ - (extensible)│ - (extensible)│                     │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                     │  │
│  │                                                                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    IToolAdapter (Core Tools)                     │   │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │  │
│  │  │  │ IBrowserTool│  │IWebSearchTool│  │     ISandboxTool        │  │   │  │
│  │  │  │ - Playwright│  │ - SearXNG   │  │  - Docker sandbox       │  │   │  │
│  │  │  │ - Puppeteer │  │ - DDG API   │  │  - Firejail (future)    │  │   │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  CONVERSATION ENGINE                                                   │  │
│  │  - Checks capabilities before tool use                                 │  │
│  │  - Graceful degradation messaging                                      │  │
│  │  - Core capability hard fails (LLM)                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      TUI (Ink/React)     │
                    │  - Chat interface         │
                    │  - Voice activation UI    │
                    │  - Settings/config panel  │
                    └───────────────────────────┘
```

---

## 3. Component Specifications

### 3.1 Capabilities Tracker

**Purpose:** Single source of truth for all adapter availability and health status.

**Responsibilities:**
- Maintain real-time capability map
- Run periodic health checks on adapters
- Emit events on status changes
- Provide "can I do X?" queries with fallback chains

**Capability Tiers:**

| Tier | Adapters | Behavior When Unavailable |
|------|----------|---------------------------|
| **CRITICAL** | LLM | Engine refuses to start. Fatal error: *"LLM required — check adapter config"* |
| **CORE TOOLS** | Browser, WebSearch, Sandbox | Graceful degradation. Message: *"Browser unavailable — I can search the web instead"* |
| **VOICE** | STT, TTS | Feature-gated. User tries to enable voice → *"STT not configured"* |
| **OPTIONAL** | MCP Extensions | Silent. Available if connected, ignored if not |

**Health Check System:**
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error' | 'offline';
  lastCheck: Date;
  latency?: number;
  error?: string;
  capabilities: string[];
}
```

### 3.2 Adapter Interface Layer

All adapters implement a common base interface:

```typescript
interface IBaseAdapter {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  
  // Lifecycle
  init(config: unknown): Promise<void>;
  destroy(): Promise<void>;
  
  // Health
  healthCheck(): Promise<HealthStatus>;
}
```

#### 3.2.1 LLM Adapter (llama.cpp)

**Implementation:** `node-llama-cpp`

**Interface:**
```typescript
interface ILLMAdapter extends IBaseAdapter {
  chat(messages: Message[]): AsyncIterable<ChatChunk>;
  listModels?(): Promise<ModelInfo[]>;
  
  // Granular control specific to llama.cpp
  getContextInfo(): ContextInfo;
  unloadModel(): Promise<void>;
}
```

**Configuration:**
```yaml
llm:
  adapter: llamacpp
  model:
    path: ~/.lo-bot/models/gemma4-8b.gguf
    contextSize: 8192
    gpuLayers: 35
  sampling:
    temperature: 0.7
    topP: 0.9
    repeatPenalty: 1.1
    seed: null  # null = random
```

**Trade-offs:**
- **Pros:** Full control over inference, manual GPU layer tuning, reproducible sampling
- **Cons:** Manual GGUF download, native dependency build, no automatic model management

#### 3.2.2 STT Adapter (Whisper + VAD)

**Interface:**
```typescript
interface ISTTAdapter extends IBaseAdapter {
  // VAD-enabled streaming (default)
  startListening(options?: ListenOptions): AsyncIterable<TranscriptionEvent>;
  stopListening(): Promise<void>;
  
  // Manual modes (alternative)
  startRecording(): Promise<void>;  // Push-to-talk start
  stopRecording(): Promise<string>; // Push-to-talk end, returns transcript
  
  // Batch processing
  transcribe(audioBuffer: Buffer): Promise<string>;
}

interface ListenOptions {
  mode?: 'vad' | 'push-to-talk' | 'wake-word';
  wakeWord?: string;  // e.g., "hey lo-bot"
  vad config?: VADConfig;
}

interface VADConfig {
  silenceThreshold?: number;   // dB threshold (default: -40)
  minSpeechDuration?: number;  // ms (default: 250)
  silenceTimeout?: number;     // ms of silence to stop (default: 1500)
  prefixPadding?: number;      // ms to include before speech (default: 300)
}

type TranscriptionEvent = 
  | { type: 'vad'; state: 'speech-start' | 'speech-end' | 'silence' }
  | { type: 'transcript'; text: string; isFinal: boolean }
  | { type: 'error'; error: string };
```

**Implementation:**
- **VAD Engine:** `silero-vad` or `snakers4/silero-vad` via ONNX Runtime
- **STT Engine:** `faster-whisper` or `whisper.cpp` server
- **Architecture:** 
  - Audio capture (mic) → VAD detection → Speech segmentation → STT transcription
  - VAD runs locally in-process for low latency (< 50ms)
  - STT can be local (whisper.cpp) or service-based (faster-whisper HTTP)

**Default Behavior (VAD):**
1. User presses `Space` or types `/voice` → Voice mode activates
2. VAD starts monitoring microphone
3. On speech detected: Visual indicator shows "Listening..."
4. User speaks naturally
5. On silence timeout (1.5s): Audio segment sent to STT
6. Transcription streams back (if streaming whisper) or returns final
7. Voice mode stays active for follow-up (until Esc or timeout)

**Alternative Modes (v2):**
- **Push-to-talk:** Hold `Space` while speaking
- **Wake word:** Always-listening for "hey lo-bot" (higher resource usage)

#### 3.2.3 TTS Adapter (Kokoro)

**Interface:**
```typescript
interface ITTSAdapter extends IBaseAdapter {
  synthesize(text: string, options: TTSOptions): Promise<AudioBuffer>;
  stream(text: string, options: TTSOptions): AsyncIterable<AudioChunk>;
  listVoices(): Promise<Voice[]>;
}
```

**Implementation:** Kokoro-FastAPI Docker container, consumed via HTTP

#### 3.2.4 Browser Tool Adapter

**Interface:**
```typescript
interface IBrowserTool extends IToolAdapter {
  tools: ['browser_navigate', 'browser_click', 'browser_type', 'browser_read', 'browser_screenshot'];
  
  navigate(url: string): Promise<PageInfo>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  read(): Promise<string>;  // Extract readable text
  screenshot(): Promise<Buffer>;
}
```

**Implementation:** Playwright (primary), Puppeteer (alternative)

#### 3.2.5 Web Search Tool Adapter

**Interface:**
```typescript
interface IWebSearchTool extends IToolAdapter {
  tools: ['web_search', 'web_fetch'];
  
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  fetch(url: string): Promise<FetchedPage>;
}
```

**Implementation:** SearXNG instance (local or configured)

#### 3.2.6 Sandbox Tool Adapter

**Interface:**
```typescript
interface ISandboxTool extends IToolAdapter {
  tools: ['sandbox_exec', 'sandbox_read_file', 'sandbox_write_file', 'sandbox_list_files'];
  
  execute(command: string, timeout?: number): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  
  safetyLevel: 'readonly' | 'network' | 'full';
}
```

**Implementation:** Docker container (primary), Firejail (future)

### 3.3 Voice Activity Detection (VAD)

**Purpose:** Detect when user is speaking to trigger transcription automatically — no buttons to hold, no wake words to remember.

**How It Works:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Microphone │────►│  VAD Engine │────►│   Speech    │────►│   Whisper   │
│   (raw PCM)  │     │(silero-vad) │     │  Segment    │     │    STT      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                            │                                          │
                            ▼                                          ▼
                    ┌───────────────┐                          ┌──────────────┐
                    │  Events:      │                          │ Transcript   │
                    │  - silence    │                          │              │
                    │  - speech-start│                         │ "What's the  │
                    │  - speech-end │                          │  weather?"   │
                    └───────────────┘                          └──────────────┘
```

**VAD Configuration (User Configurable):**
```yaml
voice:
  input:
    mode: 'vad'  # 'vad' | 'push-to-talk' | 'wake-word'
    vad:
      silenceThreshold: -40    # dB
      minSpeechDuration: 250   # ms (ignore coughs, < 250ms sounds)
      silenceTimeout: 1500     # ms (stop after 1.5s silence)
      prefixPadding: 300       # ms (include audio before speech)
```

**UX States:**
| State | Visual | Meaning |
|-------|--------|---------|
| `idle` | `◉ Voice (VAD)` | Ready, listening for speech |
| `listening` | `◉ Listening...` | VAD detected speech, capturing |
| `processing` | `◉ Processing...` | Speech ended, sending to STT |
| `speaking` | `◉ Speaking...` | TTS playing response |

### 3.4 Voice Loop

The voice loop coordinates VAD → STT → LLM → TTS:

```typescript
class VoiceLoop {
  constructor(
    private stt: ISTTAdapter,
    private llm: ILLMAdapter,
    private tts: ITTSAdapter,
    private tracker: CapabilitiesTracker,
    private ui: TUI
  ) {}

  async startVoiceMode() {
    const caps = await this.tracker.get();

    if (!caps.stt.available) {
      return this.ui.notify("Voice unavailable — STT is " + caps.stt.status);
    }

    this.ui.setVoiceState('idle');

    for await (const event of this.stt.startListening({ mode: 'vad' })) {
      switch (event.type) {
        case 'vad':
          if (event.state === 'speech-start') {
            this.ui.setVoiceState('listening');
          } else if (event.state === 'speech-end') {
            this.ui.setVoiceState('processing');
          }
          break;

        case 'transcript':
          if (event.isFinal) {
            await this.handleUserMessage(event.text);
          }
          break;

        case 'error':
          this.ui.notify("Voice error: " + event.error);
          break;
      }
    }
  }

  private async handleUserMessage(text: string) {
    // Add to chat history
    this.ui.addMessage('user', text);

    // Stream LLM response
    const response = await this.streamLLM(text);

    // Speak or display
    const caps = await this.tracker.get();
    if (caps.tts.available) {
      this.ui.setVoiceState('speaking');
      await this.tts.stream(response);
    }

    // Back to idle for next input
    this.ui.setVoiceState('idle');
  }
}
```

### 3.4 TUI (Ink/React)

**Framework:** [Ink](https://github.com/vadimdemedes/ink) — React for terminals

**Components:**
- `ChatView`: Message history with markdown rendering
- `InputBox`: Text input with multiline support
- `StatusBar`: Adapter health indicators
- `VoiceIndicator`: Visual feedback for voice mode
- `SettingsPanel`: Adapter configuration UI

---

## 4. Repository Structure

```
lo-bot/
├── .github/
│   └── workflows/
│       └── ci.yml              # PR checks, lint, test, build
├── docs/
│   ├── architecture/
│   │   ├── adapters.md
│   │   ├── capabilities.md
│   │   └── voice-loop.md
│   ├── contributing.md         # Commit conventions, PR process
│   └── api/
│       └── adapter-interfaces.md
├── src/
│   ├── core/
│   │   ├── engine.ts           # Main conversation orchestrator
│   │   ├── capability-tracker.ts
│   │   ├── adapter-registry.ts
│   │   ├── voice-loop.ts
│   │   └── types.ts
│   ├── adapters/
│   │   ├── base/
│   │   │   ├── interface.ts
│   │   │   └── base-adapter.ts
│   │   ├── llm/
│   │   │   ├── interface.ts
│   │   │   └── llamacpp-adapter.ts
│   │   ├── stt/
│   │   │   ├── interface.ts
│   │   │   └── whisper-adapter.ts
│   │   ├── tts/
│   │   │   ├── interface.ts
│   │   │   └── kokoro-adapter.ts
│   │   ├── browser/
│   │   │   ├── interface.ts
│   │   │   └── playwright-adapter.ts
│   │   ├── websearch/
│   │   │   ├── interface.ts
│   │   │   └── searxng-adapter.ts
│   │   └── sandbox/
│   │       ├── interface.ts
│   │       └── docker-adapter.ts
│   ├── tui/
│   │   ├── app.tsx
│   │   ├── components/
│   │   │   ├── chat-view.tsx
│   │   │   ├── input-box.tsx
│   │   │   ├── status-bar.tsx
│   │   │   └── settings-panel.tsx
│   │   └── hooks/
│   ├── tools/                  # Tool execution for LLM
│   │   ├── tool-registry.ts
│   │   └── schemas/
│   ├── config/
│   │   ├── loader.ts
│   │   └── defaults.ts
│   ├── utils/
│   └── types/
│       └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── adapters/
│   └── fixtures/
├── scripts/
│   ├── setup-local-llm.sh      # Download GGUF models
│   └── setup-deps.sh           # Install whisper, kokoro services
├── docker/
│   ├── Dockerfile.sandbox
│   ├── docker-compose.yml      # Kokoro, SearXNG services
│   └── searxng/
├── config/
│   ├── adapters.yaml.example
│   └── settings.yaml.example
├── package.json
├── tsconfig.json
├── biome.json                  # Linting & formatting
└── README.md
```

---

## 5. Development Standards

### 5.1 Version Control

#### Branch Strategy
```
main ───► protected, deployable (requires PR review)
  │
  ├── feature/llm-adapter
  ├── fix/capabilities-race-condition
  ├── refactor/simplify-voice-loop
  └── docs/architecture-update
```

#### Commit Convention (Conventional Commits)
```
type(scope): subject [max 72 chars]

body (optional) - explain WHY, not what

BREAKING CHANGE: (if applicable)
```

| Type | Use For | Example |
|------|---------|---------|
| `feat` | New capability/adapter | `feat(sandbox): add docker sandbox adapter` |
| `fix` | Bug fix | `fix(tracker): handle adapter reconnect race` |
| `refactor` | Code change, no behavior change | `refactor(llm): extract sampling logic` |
| `test` | Test additions/changes | `test(browser): add playwright mock tests` |
| `docs` | Documentation | `docs(capabilities): update health check spec` |
| `chore` | Tooling, deps | `chore(deps): bump node-llama-cpp to 0.3.0` |

#### Atomic Commits
- One logical change per commit
- Each commit must build and pass tests
- Never mix feat + fix + refactor in one commit

### 5.2 Code Quality

#### SOLID Principles
| Principle | Application |
|-----------|-------------|
| Single Responsibility | One adapter = one job. Browser ≠ Search ≠ Sandbox. |
| Open/Closed | New adapter? Implement interface. Don't modify engine. |
| Liskov Substitution | Swap Ollama ↔ llama.cpp. Engine doesn't care. |
| Interface Segregation | `ILLMAdapter` ≠ `IToolAdapter`. No forced methods. |
| Dependency Inversion | Engine depends on interfaces, not implementations. |

#### YAGNI (You Aren't Gonna Need It)
- No "plugin marketplace" until v2
- No "cloud sync" until explicitly requested
- No "voice profiles" until TTS works end-to-end
- Ask: *"Is this needed for the current story?"*

---

## 6. External Services

### 6.1 Kokoro TTS

**Deployment:** Docker container (Kokoro-FastAPI)

**Interface:** OpenAI-compatible HTTP API at `http://localhost:8880`

**Integration:**
```typescript
// TTS adapter calls local endpoint
const response = await fetch('http://localhost:8880/v1/audio/speech', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'kokoro',
    input: text,
    voice: 'af_bella',
    response_format: 'mp3'
  })
});
```

### 6.2 Whisper STT

**Deployment:** Python service with `faster-whisper` or `whisper.cpp` server

**Interface:** HTTP streaming endpoint

### 6.3 SearXNG (Web Search)

**Deployment:** Docker container

**Interface:** JSON API at `http://localhost:8080/search?q={query}&format=json`

---

## 7. Error Handling & Graceful Degradation

### Core Capability Failure (LLM)
```typescript
if (!caps.llm.available) {
  throw new FatalError(
    'LLM adapter is required but unavailable. ' +
    'Status: ' + caps.llm.status + '. ' +
    'Please check your llama.cpp configuration.'
  );
  // Engine refuses to start
}
```

### Tool Unavailability
```typescript
if (!caps.browser.available) {
  return {
    success: false,
    message: 'Browser unavailable (Playwright not running). ' +
             'I can search for information instead. ' +
             'Would you like me to search the web?'
  };
}
```

### Voice Feature Gating
```typescript
if (!caps.stt.available && userRequestsVoice) {
  notifyUser(
    'Voice input unavailable. ' +
    'STT adapter status: ' + caps.stt.status + '. ' +
    'Type your message or run /settings to configure STT.'
  );
}
```

---

## 8. Testing Strategy

| Level | Scope | Tools |
|-------|-------|-------|
| Unit | Individual functions, adapters | Vitest |
| Integration | Adapter ↔ Service (real LLM/TTS calls) | Vitest + Docker |
| E2E | Full conversation flows | Playwright (terminal) |
| Contract | Adapter interface compliance | Custom validator |

---

## 9. Deployment & Distribution

### Development Setup
```bash
# 1. Clone
git clone https://github.com/user/lo-bot.git
cd lo-bot

# 2. Install deps
npm install

# 3. Setup external services
npm run setup:services  # Starts Kokoro, SearXNG, Whisper via Docker

# 4. Download LLM
npm run setup:models    # Downloads GGUF to ~/.lo-bot/models

# 5. Run
npm run dev
```

### Distribution
- npm package: `npm install -g lo-bot`
- GitHub Releases with prebuilt binaries
- Homebrew formula (future)

---

## 10. Future Extensions (Out of Scope for v1)

- MCP server bridge for community extensions
- Cloud sync for settings (optional, opt-in)
- Mobile companion app
- Multi-user support
- Plugin marketplace

---

## 3.5 IToolAdapter Interface (Explicit)

**Base Interface:**
```typescript
interface IToolAdapter extends IBaseAdapter {
  readonly tools: ToolDefinition[];
  readonly isDestructive: boolean;
  execute(toolName: string, params: unknown): Promise<ToolResult>;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

**All tool adapters must implement:**
1. `tools` array with name, description, and parameter schema
2. `execute(toolName, params)` returning `ToolResult`
3. `isDestructive` flag for safety confirmation prompts

---

## 3.6 Voice Loop: Sentence-Boundary Streaming

**Problem:** Buffering full LLM response before TTS feels slow.

**Solution:** Stream LLM output sentence-by-sentence, pipe each sentence to TTS immediately.

```typescript
class VoiceLoop {
  // ... existing properties ...
  private interruptController?: AbortController;

  async *streamResponseToTTS(llmStream: AsyncIterable<ChatChunk>): AsyncGenerator<string> {
    let buffer = '';
    const sentenceEnd = /[.!?]+\s*/g;

    for await (const chunk of llmStream) {
      // Check for user interrupt
      if (this.interruptController?.signal.aborted) {
        break;
      }

      buffer += chunk.content;


      // Extract complete sentences
      let match;
      while ((match = sentenceEnd.exec(buffer)) !== null) {
        const sentence = buffer.slice(0, match.end);
        buffer = buffer.slice(match.end);


        // Stream sentence to TTS immediately
        if (this.tts) {
          await this.tts.stream(sentence.trim());
        }

        yield sentence;
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      if (this.tts) {
        await this.tts.stream(buffer.trim());
      }
      yield buffer;
    }
  }

  interrupt(): void {
    // User pressed Escape or started speaking during response
    this.interruptController?.abort();
    this.interruptController = new AbortController();
    
    // Stop TTS playback immediately
    this.tts?.stop?.();
    
    this.setState('idle');
  }
}
```

**Interrupt Mechanism:**
- User presses `Escape` during TTS playback → stops immediately
- User speaks during LLM generation → VAD detects new speech, interrupts current response
- State returns to `idle` for next input

---

## 3.7 Conversation History & Context Management

**Storage:** In-memory with optional SQLite persistence

**Interface:**
```typescript
interface ConversationHistory {
  messages: Message[];
  add(role: MessageRole, content: string): void;
  getMessages(limit?: number): Message[];
  getTokenCount(): number;
  truncate(maxTokens: number): void;
  summarize(): Promise<string>;  // LLM summarization when overflow
  clear(): void;
}
```

**Truncation Strategy:**
1. Keep system prompt (fixed)
2. Keep last N messages that fit in context (e.g., last 20)
3. If still overflow: call LLM to summarize older messages into a brief context snippet
4. Use `node-llama-cpp` context management to handle token counting

**Persistence (optional):**
```yaml
history:
  storage: 'memory'  # 'memory' | 'sqlite' | 'file'
  filePath: '~/.lo-bot/history.jsonl'
  maxMessages: 1000
  truncateAt: 7000  # tokens, leave 1024 for response
```

---

## 3.8 Tool-Calling Format for Local Models


**Challenge:** Local models vary wildly in tool-calling quality.

**Solution:** Grammar-constrained JSON generation + structured prompting.

```typescript
interface ToolCallingConfig {
  // JSON Schema for all tools
  toolSchema: Record<string, ToolDefinition>;
  
  // Grammar file for node-llama-cpp (generated from schema)
  grammarPath?: string;
  
  // Fallback: regex extraction if grammar fails
  extractionPattern: /\{"tool":\s*"(\w+)",\s*"params":\s*(\{|\[)/g;
}

const SYSTEM_PROMPT = `You are a helpful assistant with access to tools.

Available tools:
${JSON.stringify(toolDefinitions, null, 2)}

When you need to use a tool, respond ONLY with:
{"tool": "tool_name", "params": {...}}

Do not explain your reasoning. Just output the tool call.`;
```

**Grammar Generation:**
- Generate JSON grammar file from tool schemas at build time
- Use `llama.cpp` grammar support for constrained output
- Fallback: Regex extract if model produces malformed JSON

**Flow:**
```
User: "Visit example.com"
LLM: {"tool": "browser_navigate", "params": {"url": "https://example.com"}}
  │
  ▼
Engine parses tool call → Executes adapter → Returns result
  │
  ▼
LLM: "I've navigated to example.com. Here's what I found..."
```

---

## 3.9 Sandbox Safety Policy

**Policy Interface:**
```typescript
interface SandboxPolicy {
  level: 'readonly' | 'network' | 'full';
  allowedCommands: string[];     // e.g., ['python', 'node', 'bash', 'curl']
  allowedPaths: string[];        // e.g., ['/workspace', '/tmp']
  maxDuration: number;          // ms, default 30000
  maxMemory: string;           // e.g., '512m', '1g'
  networkAccess: boolean;
  envWhitelist: string[];       // e.g., ['PATH', 'HOME']
}

// Default policies per intent
const POLICIES = {
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
    allowedCommands: ['python', 'node', 'bash', 'sh'],
    allowedPaths: ['/workspace'],
    maxDuration: 60000,
    maxMemory: '1g',
    networkAccess: true,
    envWhitelist: ['PATH', 'HOME', 'USER']
  }
};
```

**Safety Level Selection:**
| User Request | Policy | Requires Confirmation |
|--------------|--------|----------------------|
| "Analyze this code" | `readonly` | No |
| "Check this API" | `network` | No |
| "Run this script" | `full` | **Yes** (explicit user approval) |
| "Install dependencies" | `full` | **Yes** |

**Engine Behavior:**
```typescript
async executeTool(tool: string, params: unknown) {
  const requiredPolicy = determinePolicy(tool, params);
  
  if (requiredPolicy.level === 'full') {
    const confirmed = await this.promptUser(
      `Allow ${tool} with full sandbox access?`
    );
    if (!confirmed) return { success: false, error: 'User declined' };
  }
  
  return sandboxAdapter.execute(tool, params, requiredPolicy);
}
```

---

## 11. Open Questions

None. Design approved by user.

---

## 12. Approval

| Role | Name | Date | Approved |
|------|------|------|----------|
| Designer | AI Assistant | 2025-06-05 | ✅ |
| Product Owner | User | 2025-06-05 | ✅ |
