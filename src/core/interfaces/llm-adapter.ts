import type { IBaseAdapter, Message, ChatChunk } from '../types.js';

/**
 * Context information from LLM adapter
 */
export interface ContextInfo {
  /** Total context size in tokens */
  size: number;
  /** Currently used tokens */
  used: number;
}

/**
 * LLM Adapter Interface
 * All language model adapters must implement this interface.
 */
export interface ILLMAdapter extends IBaseAdapter {
  /**
   * Stream chat completions from the LLM.
   * @param messages - Conversation history
   * @yield - ChatChunk content as it arrives
   */
  chat(messages: Message[]): AsyncIterable<ChatChunk>;

  /**
   * Get current context information.
   */
  getContextInfo(): ContextInfo;

  /**
   * Unload the model from memory.
   */
  unloadModel(): Promise<void>;
}