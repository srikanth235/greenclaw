/**
 * Shared Zod schemas and derived TypeScript types for GreenClaw.
 * @module @greenclaw/types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Alert & usage analytics schemas
// ---------------------------------------------------------------------------

/** Supported alert metrics. */
export const AlertMetricSchema = z.enum([
  'daily_tokens',
  'daily_cost',
  'weekly_cost',
  'per_model_cost',
]);
/** @see {@link AlertMetricSchema} */
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

/** Alert threshold units. */
export const ThresholdUnitSchema = z.enum(['tokens', 'usd']);
/** @see {@link ThresholdUnitSchema} */
export type ThresholdUnit = z.infer<typeof ThresholdUnitSchema>;

/** Time period for aggregations and alerts. */
export const AlertPeriodSchema = z.enum(['day', 'week', 'month']);
/** @see {@link AlertPeriodSchema} */
export type AlertPeriod = z.infer<typeof AlertPeriodSchema>;

/** A user-defined alert rule. */
export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: AlertMetricSchema,
  threshold_value: z.number(),
  threshold_unit: ThresholdUnitSchema,
  period: AlertPeriodSchema,
  model_filter: z.string().nullable(),
  enabled: z.boolean(),
  created_at: z.string(),
});
/** @see {@link AlertRuleSchema} */
export type AlertRule = z.infer<typeof AlertRuleSchema>;

/** A triggered alert event record. */
export const AlertEventSchema = z.object({
  id: z.string(),
  rule_id: z.string(),
  triggered_at: z.string(),
  metric_value: z.number(),
  threshold_value: z.number(),
  period_start: z.string(),
  period_end: z.string(),
  acknowledged: z.boolean(),
});
/** @see {@link AlertEventSchema} */
export type AlertEvent = z.infer<typeof AlertEventSchema>;

// ---------------------------------------------------------------------------
// TODO: OpenAI-compatible request/response types, TaskTier enum,
// RequestTrace schema, ProviderModel type
// ---------------------------------------------------------------------------
