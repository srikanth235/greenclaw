/**
 * Context compactor.
 * @module @greenclaw/optimization/compactor
 */

import type { ChatMessage } from '@greenclaw/types';

/**
 * Return the message list unchanged until compaction rules are implemented.
 * @param messages - Request messages
 * @param tokenLimit - Maximum prompt token budget
 * @returns The message list to forward upstream
 */
export function compact(messages: ChatMessage[], tokenLimit: number): ChatMessage[] {
  void tokenLimit;
  return messages;
}
