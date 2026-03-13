/**
 * Heuristic task classifier for GreenClaw routing.
 * @module @greenclaw/optimization/classifier
 */

import type { ChatMessage, TaskTier } from '@greenclaw/types';

const HEARTBEAT_PATTERNS = [
  /\bheartbeat\b/i,
  /\bhealthz\b/i,
  /\bliveness\b/i,
  /\bkeepalive\b/i,
  /\bwatchdog\b/i,
  /\breadiness\b/i,
  /\buptime\b/i,
  /\bstatus only\b/i,
  /\bsynthetic monitor\b/i,
  /\bping\b/i,
  /\bpong\b/i,
];

const COMPLEX_PATTERNS = [
  /\bmulti-agent\b/i,
  /\bsub-agents\b/i,
  /\bincident response coordinator\b/i,
  /\bsenior software architect\b/i,
  /\bresearch and analysis agent\b/i,
  /\bfull-stack development agent\b/i,
  /\bsecurity audit\b/i,
  /\binfrastructure-as-code\b/i,
  /\bkubernetes\b/i,
  /\bterraform\b/i,
  /\bmachine learning operations\b/i,
  /\bmlops\b/i,
  /\bzero-downtime\b/i,
  /\bcoordinate cross-team\b/i,
  /\bgpu\b/i,
];

const MODERATE_PATTERNS = [
  /\bdraft\b/i,
  /\bsummarize\b/i,
  /\bcreate a jira ticket\b/i,
  /\bbreakdown\b/i,
  /\bfind me round-trip flights\b/i,
  /\bcheck the logs\b/i,
  /\bdraft a response\b/i,
  /\bschedule a meeting\b/i,
  /\bpull the logs\b/i,
  /\breview pr\b/i,
  /\bextract action items\b/i,
  /\bcpu utilization\b/i,
  /\bcompare\b/i,
  /\bformat as a table\b/i,
  /\bflag anything\b/i,
];

const SIMPLE_PATTERNS = [
  /\bwhat is\b/i,
  /\bconvert\b/i,
  /\bdefine\b/i,
  /\btranslate\b/i,
  /\bshow me\b/i,
  /\blook up\b/i,
  /\bcurrent price\b/i,
  /\bweather\b/i,
  /\bcapital\b/i,
];

/**
 * Classify a request into one of the routing tiers.
 * @param messages - Request messages to inspect
 * @param model - Requested model name
 * @returns The classified task tier
 */
export function classify(messages: ChatMessage[], model: string): TaskTier {
  const text = messages
    .map((message) => message.content ?? '')
    .join('\n')
    .trim();
  const normalizedModel = model.trim().toLowerCase();
  const toolCallCount = messages.reduce(
    (count, message) => count + (message.tool_calls?.length ?? 0),
    0,
  );

  if (HEARTBEAT_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'HEARTBEAT';
  }

  if (COMPLEX_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'COMPLEX';
  }

  if (
    toolCallCount >= 2 ||
    messages.length >= 4 ||
    MODERATE_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return 'MODERATE';
  }

  if (
    normalizedModel === 'auto' ||
    normalizedModel === 'greenclaw/auto' ||
    SIMPLE_PATTERNS.some((pattern) => pattern.test(text)) ||
    toolCallCount === 1
  ) {
    return 'SIMPLE';
  }

  return 'MODERATE';
}
