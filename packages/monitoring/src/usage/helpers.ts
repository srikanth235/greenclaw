/**
 * Monitoring helper types, SQL, and utilities.
 * @module @greenclaw/monitoring/usage/helpers
 */

import type { UsageSummary, UsageBreakdown, UsageTrend } from './types.js';

/** Alert rule configuration. */
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold_value: number;
  threshold_unit: string;
  period: string;
  model_filter: string | null;
  enabled: boolean;
  created_at: string;
}

/** Triggered alert event. */
export interface AlertEvent {
  id: string;
  rule_id: string;
  triggered_at: string;
  metric_value: number;
  threshold_value: number;
  period_start: string;
  period_end: string;
  acknowledged: boolean;
}

/** Usage store interface. */
export interface UsageStore {
  summary(period: string): UsageSummary;
  breakdown(groupBy: 'model' | 'tier' | 'provider', period: string): UsageBreakdown[];
  trends(period: 'day' | 'week', last: number): UsageTrend[];
  listRules(): AlertRule[];
  setRule(rule: AlertRule): void;
  removeRule(id: string): boolean;
  checkAlerts(): AlertEvent[];
  alertHistory(limit: number): AlertEvent[];
  close(): void;
}

/** SQL to create alert tables. */
export const CREATE_ALERT_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS alert_rules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  metric           TEXT NOT NULL,
  threshold_value  REAL NOT NULL,
  threshold_unit   TEXT NOT NULL,
  period           TEXT NOT NULL,
  model_filter     TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_events (
  id               TEXT PRIMARY KEY,
  rule_id          TEXT NOT NULL,
  triggered_at     TEXT NOT NULL,
  metric_value     REAL NOT NULL,
  threshold_value  REAL NOT NULL,
  period_start     TEXT NOT NULL,
  period_end       TEXT NOT NULL,
  acknowledged     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_events_dedup ON alert_events(rule_id, period_start);
CREATE INDEX IF NOT EXISTS idx_alert_events_triggered ON alert_events(triggered_at);
`;

/**
 * Compute the start and end of the current period in UTC.
 * @param period - 'day', 'week', or 'month'
 * @returns [periodStart, periodEnd] as ISO strings
 */
export function periodBounds(period: string): [string, string] {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === 'week') {
    const day = now.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
    end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }

  return [start.toISOString(), end.toISOString()];
}

/**
 * Generate a short random ID.
 * @returns A unique string ID
 */
export function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a no-op usage store for graceful degradation.
 * @returns UsageStore that returns empty results
 */
export function createNoOpUsageStore(): UsageStore {
  const empty: UsageSummary = {
    period: 'day',
    period_start: '',
    period_end: '',
    total_tokens: 0,
    total_cost_usd: 0,
    total_savings_usd: 0,
    request_count: 0,
  };
  return {
    summary: () => empty,
    breakdown: () => [],
    trends: () => [],
    listRules: () => [],
    setRule: () => {},
    removeRule: () => false,
    checkAlerts: () => [],
    alertHistory: () => [],
    close: () => {},
  };
}
