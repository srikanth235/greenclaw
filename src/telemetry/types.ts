/**
 * Telemetry type definitions.
 * Local to this module until src/types/ implements RequestTrace via Zod.
 * These mirror the schema documented in docs/conventions/observability.md.
 * @module telemetry/types
 */

/** Token counts for a proxied request. */
export interface TraceTokens {
  prompt: number;
  completion: number;
  total: number;
}

/** Cost estimates for a proxied request. */
export interface TraceCost {
  original_usd: number;
  routed_usd: number;
  savings_usd: number;
}

/** Latency breakdown in milliseconds. */
export interface TraceLatency {
  classify: number;
  compact: number;
  route: number;
  upstream: number;
  total: number;
}

/** A single request trace record. */
export interface RequestTrace {
  id: string;
  timestamp: string;
  request_id: string;
  original_model: string;
  routed_model: string;
  routed_provider: string;
  task_tier: string;
  compaction_applied: boolean;
  tokens: TraceTokens;
  estimated_cost: TraceCost;
  latency_ms: TraceLatency;
  upstream_status: number | null;
  error: string | null;
}

/** Aggregated telemetry statistics. */
export interface TelemetryStats {
  totalTraces: number;
  tracesByTier: Record<string, number>;
  avgLatencyMs: number;
  totalSavingsUsd: number;
}

/** Telemetry store interface for trace persistence and querying. */
export interface TelemetryStore {
  /** Insert a single request trace. */
  insertTrace(trace: RequestTrace): void;
  /** Query traces within a time range (ISO 8601 strings). */
  queryByTimeRange(from: string, to: string): RequestTrace[];
  /** Query traces by task tier. */
  queryByTier(tier: string): RequestTrace[];
  /** Query traces by routed model name. */
  queryByModel(model: string): RequestTrace[];
  /** Query traces where total latency exceeds a threshold. */
  querySlowRequests(thresholdMs: number): RequestTrace[];
  /** Get aggregated statistics across all traces. */
  getStats(): TelemetryStats;
  /** Close the database connection. */
  close(): void;
}
