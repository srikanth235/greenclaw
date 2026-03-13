/**
 * Shared telemetry schemas.
 * @module @greenclaw/types/telemetry
 */

import { z } from 'zod';
import { TaskTierSchema } from './proxy.js';

/** Token counts for a proxied request. */
export const TraceTokensSchema = z.object({
  prompt: z.number(),
  completion: z.number(),
  total: z.number(),
});
/** Token counts for a proxied request. */
export type TraceTokens = z.infer<typeof TraceTokensSchema>;

/** Estimated cost comparison for a proxied request. */
export const TraceCostSchema = z.object({
  original_usd: z.number(),
  routed_usd: z.number(),
  savings_usd: z.number(),
});
/** Estimated cost comparison for a proxied request. */
export type TraceCost = z.infer<typeof TraceCostSchema>;

/** Latency breakdown in milliseconds for a proxied request. */
export const TraceLatencySchema = z.object({
  classify: z.number(),
  compact: z.number(),
  route: z.number(),
  upstream: z.number(),
  total: z.number(),
});
/** Latency breakdown in milliseconds for a proxied request. */
export type TraceLatency = z.infer<typeof TraceLatencySchema>;

/** RequestTrace payload persisted to telemetry storage. */
export const RequestTraceSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  request_id: z.string(),
  original_model: z.string(),
  routed_model: z.string(),
  routed_provider: z.string(),
  task_tier: TaskTierSchema,
  compaction_applied: z.boolean(),
  tokens: TraceTokensSchema,
  estimated_cost: TraceCostSchema,
  latency_ms: TraceLatencySchema,
  upstream_status: z.number().nullable(),
  error: z.string().nullable(),
});
/** RequestTrace payload persisted to telemetry storage. */
export type RequestTrace = z.infer<typeof RequestTraceSchema>;
