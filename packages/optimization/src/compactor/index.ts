/**
 * Context compactor.
 * @module @greenclaw/optimization/compactor
 */

import type { ChatMessage } from '@greenclaw/types';

/** Result of a compaction pass. */
export interface CompactResult {
  /** Messages to forward upstream. */
  messages: ChatMessage[];
  /** Whether compaction actually reduced the message list. */
  applied: boolean;
}

/**
 * Return the message list unchanged until compaction rules are implemented.
 * @param messages - Request messages
 * @param tokenLimit - Maximum prompt token budget
 * @returns Compaction result with applied flag
 */
export function compact(messages: ChatMessage[], tokenLimit: number): CompactResult {
  void tokenLimit;
  return { messages, applied: false };
}
