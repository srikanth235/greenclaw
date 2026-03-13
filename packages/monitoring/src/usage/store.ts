/**
 * Usage analytics store — aggregation queries over request_traces + alert CRUD.
 * @module @greenclaw/monitoring/usage/store
 */

import type Database from 'better-sqlite3';
import {
  type AlertEvent,
  type AlertRule,
  CREATE_ALERT_TABLES_SQL,
  createNoOpUsageStore,
  periodBounds,
  randomId,
  type UsageStore,
} from './helpers.js';
import type { UsageBreakdown, UsageSummary, UsageTrend } from './types.js';

export type { UsageStore } from './helpers.js';

/**
 * Create a usage analytics store backed by the shared telemetry SQLite DB.
 * @param db - better-sqlite3 Database handle (from telemetry getDb()), or null
 * @returns UsageStore instance
 */
export function createUsageStore(db: Database.Database | null): UsageStore {
  if (!db) return createNoOpUsageStore();

  // Create alert tables
  db.exec(CREATE_ALERT_TABLES_SQL);

  return {
    summary(period: string): UsageSummary {
      const [start, end] = periodBounds(period);
      const row = db
        .prepare(
          `
        SELECT
          COALESCE(SUM(tokens_total), 0) AS total_tokens,
          COALESCE(SUM(cost_routed_usd), 0) AS total_cost_usd,
          COALESCE(SUM(cost_savings_usd), 0) AS total_savings_usd,
          COUNT(*) AS request_count
        FROM request_traces
        WHERE timestamp >= ? AND timestamp < ?
      `,
        )
        .get(start, end) as {
        total_tokens: number;
        total_cost_usd: number;
        total_savings_usd: number;
        request_count: number;
      };
      return { period, period_start: start, period_end: end, ...row };
    },

    breakdown(groupBy: 'model' | 'tier' | 'provider', period: string): UsageBreakdown[] {
      const [start, end] = periodBounds(period);
      const col =
        groupBy === 'model' ? 'routed_model' : groupBy === 'tier' ? 'task_tier' : 'routed_provider';
      const rows = db
        .prepare(
          `
        SELECT
          ${col} AS group_key,
          COALESCE(SUM(tokens_total), 0) AS total_tokens,
          COALESCE(SUM(cost_routed_usd), 0) AS total_cost_usd,
          COALESCE(SUM(cost_savings_usd), 0) AS total_savings_usd,
          COUNT(*) AS request_count
        FROM request_traces
        WHERE timestamp >= ? AND timestamp < ?
        GROUP BY ${col}
        ORDER BY total_cost_usd DESC
      `,
        )
        .all(start, end) as UsageBreakdown[];
      return rows;
    },

    trends(period: 'day' | 'week', last: number): UsageTrend[] {
      const msPerPeriod = period === 'week' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - last * msPerPeriod).toISOString();
      const groupExpr = period === 'week' ? "strftime('%Y-W%W', timestamp)" : 'DATE(timestamp)';
      const rows = db
        .prepare(
          `
        SELECT
          ${groupExpr} AS period_start,
          COALESCE(SUM(tokens_total), 0) AS total_tokens,
          COALESCE(SUM(cost_routed_usd), 0) AS total_cost_usd,
          COALESCE(SUM(cost_savings_usd), 0) AS total_savings_usd,
          COUNT(*) AS request_count
        FROM request_traces
        WHERE timestamp >= ?
        GROUP BY ${groupExpr}
        ORDER BY period_start ASC
      `,
        )
        .all(since) as UsageTrend[];
      return rows;
    },

    listRules(): AlertRule[] {
      const rows = db.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC').all() as Array<{
        id: string;
        name: string;
        metric: string;
        threshold_value: number;
        threshold_unit: string;
        period: string;
        model_filter: string | null;
        enabled: number;
        created_at: string;
      }>;
      return rows.map((r) => ({ ...r, enabled: r.enabled === 1 }));
    },

    setRule(rule: AlertRule): void {
      db.prepare(
        `
        INSERT OR REPLACE INTO alert_rules
        (id, name, metric, threshold_value, threshold_unit, period, model_filter, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        rule.id,
        rule.name,
        rule.metric,
        rule.threshold_value,
        rule.threshold_unit,
        rule.period,
        rule.model_filter,
        rule.enabled ? 1 : 0,
        rule.created_at,
      );
    },

    removeRule(id: string): boolean {
      const result = db.prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
      return result.changes > 0;
    },

    checkAlerts(): AlertEvent[] {
      const rules = db.prepare('SELECT * FROM alert_rules WHERE enabled = 1').all() as Array<{
        id: string;
        name: string;
        metric: string;
        threshold_value: number;
        threshold_unit: string;
        period: string;
        model_filter: string | null;
        enabled: number;
        created_at: string;
      }>;
      const triggered: AlertEvent[] = [];

      for (const rule of rules) {
        const [start, end] = periodBounds(rule.period);

        // Compute metric value
        let metricValue = 0;
        if (
          rule.metric === 'daily_tokens' ||
          rule.metric === 'daily_cost' ||
          rule.metric === 'weekly_cost'
        ) {
          const col = rule.metric.includes('tokens') ? 'tokens_total' : 'cost_routed_usd';
          const row = db
            .prepare(
              `
            SELECT COALESCE(SUM(${col}), 0) AS val FROM request_traces
            WHERE timestamp >= ? AND timestamp < ?
          `,
            )
            .get(start, end) as { val: number };
          metricValue = row.val;
        } else if (rule.metric === 'per_model_cost' && rule.model_filter) {
          const row = db
            .prepare(
              `
            SELECT COALESCE(SUM(cost_routed_usd), 0) AS val FROM request_traces
            WHERE timestamp >= ? AND timestamp < ? AND routed_model = ?
          `,
            )
            .get(start, end, rule.model_filter) as { val: number };
          metricValue = row.val;
        }

        if (metricValue > rule.threshold_value) {
          const event: AlertEvent = {
            id: `evt-${randomId()}`,
            rule_id: rule.id,
            triggered_at: new Date().toISOString(),
            metric_value: metricValue,
            threshold_value: rule.threshold_value,
            period_start: start,
            period_end: end,
            acknowledged: false,
          };
          // INSERT OR IGNORE: UNIQUE(rule_id, period_start) prevents duplicates atomically
          const result = db
            .prepare(
              `
            INSERT OR IGNORE INTO alert_events
            (id, rule_id, triggered_at, metric_value, threshold_value, period_start, period_end, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
            )
            .run(
              event.id,
              event.rule_id,
              event.triggered_at,
              event.metric_value,
              event.threshold_value,
              event.period_start,
              event.period_end,
              0,
            );
          if (result.changes > 0) {
            triggered.push(event);
          }
        }
      }

      return triggered;
    },

    alertHistory(limit: number): AlertEvent[] {
      const rows = db
        .prepare('SELECT * FROM alert_events ORDER BY triggered_at DESC LIMIT ?')
        .all(limit) as Array<{
        id: string;
        rule_id: string;
        triggered_at: string;
        metric_value: number;
        threshold_value: number;
        period_start: string;
        period_end: string;
        acknowledged: number;
      }>;
      return rows.map((r) => ({ ...r, acknowledged: r.acknowledged === 1 }));
    },

    close(): void {
      // DB lifecycle owned by telemetry — we don't close it
    },
  };
}
