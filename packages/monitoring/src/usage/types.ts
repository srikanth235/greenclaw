/**
 * Module-internal types for usage analytics.
 * @module @greenclaw/monitoring/usage/types
 */

/** Aggregated usage summary for a time period. */
export interface UsageSummary {
  period: string;
  period_start: string;
  period_end: string;
  total_tokens: number;
  total_cost_usd: number;
  total_savings_usd: number;
  request_count: number;
}

/** Usage stats grouped by a key (model, tier, or provider). */
export interface UsageBreakdown {
  group_key: string;
  total_tokens: number;
  total_cost_usd: number;
  total_savings_usd: number;
  request_count: number;
}

/** A single data point in a usage time series. */
export interface UsageTrend {
  period_start: string;
  total_tokens: number;
  total_cost_usd: number;
  total_savings_usd: number;
  request_count: number;
}
