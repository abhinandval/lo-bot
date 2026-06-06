/**
 * Core type definitions for Lo-Bot
 */

// ============================================================================
// Health & Capabilities
// ============================================================================

export type HealthStatusType = 'healthy' | 'degraded' | 'error' | 'offline';

export interface HealthStatus {
  status: HealthStatusType;
  lastCheck: Date;
  latency?: number;
  error?: string;
  capabilities: string[];
}

export type CapabilityTier = 'critical' | 'core' | 'voice' | 'optional';

export interface CapabilityInfo {
  available: boolean;
  status: HealthStatusType;
  required: boolean;
  tier: CapabilityTier;
}

export interface CapabilityMap {
  llm?: CapabilityInfo;
  stt?: CapabilityInfo;
  tts?: CapabilityInfo;
  browser?: CapabilityInfo;
  websearch?: CapabilityInfo;
  sandbox?: CapabilityInfo;
}

// ============================================================================
// Chat / Messages
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatChunk {
  content: string;
  done?: boolean;
}

// ============================================================================
// Voice Types
// ============================================================================

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