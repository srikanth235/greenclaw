/**
 * Row conversion utilities for telemetry store.
 * Maps between nested RequestTrace objects and flat SQLite rows.
 * @module telemetry/row
 */

import type { RequestTrace } from './types.js';

/** Flat row matching SQL column names. */
export interface FlatRow {
  id: string;
  timestamp: string;
  request_id: string;
  original_model: string;
  routed_model: string;
  routed_provider: string;
  task_tier: RequestTrace['task_tier'];
  compaction_applied: number;
  tokens_prompt: number;
  tokens_completion: number;
  tokens_total: number;
  cost_original_usd: number;
  cost_routed_usd: number;
  cost_savings_usd: number;
  latency_classify_ms: number;
  latency_compact_ms: number;
  latency_route_ms: number;
  latency_upstream_ms: number;
  latency_total_ms: number;
  upstream_status: number | null;
  error: string | null;
}

/**
 * Normalize an ISO-8601 timestamp to canonical UTC (Z suffix).
 * @param iso - Any valid ISO-8601 string
 * @returns UTC ISO string, or the original if unparseable
 */
export function toUtcIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString();
}

/**
 * Flatten a RequestTrace into a flat row for SQL insertion.
 * @param trace - The nested RequestTrace object
 * @returns Flat key-value object matching SQL column names
 */
export function traceToRow(trace: RequestTrace): FlatRow {
  return {
    id: trace.id,
    timestamp: toUtcIso(trace.timestamp),
    request_id: trace.request_id,
    original_model: trace.original_model,
    routed_model: trace.routed_model,
    routed_provider: trace.routed_provider,
    task_tier: trace.task_tier,
    compaction_applied: trace.compaction_applied ? 1 : 0,
    tokens_prompt: trace.tokens.prompt,
    tokens_completion: trace.tokens.completion,
    tokens_total: trace.tokens.total,
    cost_original_usd: trace.estimated_cost.original_usd,
    cost_routed_usd: trace.estimated_cost.routed_usd,
    cost_savings_usd: trace.estimated_cost.savings_usd,
    latency_classify_ms: trace.latency_ms.classify,
    latency_compact_ms: trace.latency_ms.compact,
    latency_route_ms: trace.latency_ms.route,
    latency_upstream_ms: trace.latency_ms.upstream,
    latency_total_ms: trace.latency_ms.total,
    upstream_status: trace.upstream_status,
    error: trace.error,
  };
}

/**
 * Reconstruct a RequestTrace from a flat SQLite row.
 * @param row - Flat row from the database
 * @returns Nested RequestTrace object
 */
export function rowToTrace(row: FlatRow): RequestTrace {
  return {
    id: row.id,
    timestamp: row.timestamp,
    request_id: row.request_id,
    original_model: row.original_model,
    routed_model: row.routed_model,
    routed_provider: row.routed_provider,
    task_tier: row.task_tier,
    compaction_applied: row.compaction_applied === 1,
    tokens: {
      prompt: row.tokens_prompt,
      completion: row.tokens_completion,
      total: row.tokens_total,
    },
    estimated_cost: {
      original_usd: row.cost_original_usd,
      routed_usd: row.cost_routed_usd,
      savings_usd: row.cost_savings_usd,
    },
    latency_ms: {
      classify: row.latency_classify_ms,
      compact: row.latency_compact_ms,
      route: row.latency_route_ms,
      upstream: row.latency_upstream_ms,
      total: row.latency_total_ms,
    },
    upstream_status: row.upstream_status,
    error: row.error,
  };
}
