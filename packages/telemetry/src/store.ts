/**
 * SQLite-backed telemetry store for RequestTrace persistence.
 * Provides insert and query operations over a local SQLite database.
 * Falls back to a no-op store if initialization fails, ensuring the
 * proxy never crashes due to telemetry issues.
 * @module telemetry/store
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { type FlatRow, rowToTrace, toUtcIso, traceToRow } from './row.js';
import type { RequestTrace, TelemetryStats, TelemetryStore } from './types.js';

export type { FlatRow } from './row.js';
export type {
  RequestTrace,
  TelemetryStats,
  TelemetryStore,
  TraceCost,
  TraceLatency,
  TraceTokens,
} from './types.js';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS request_traces (
  id                  TEXT PRIMARY KEY,
  timestamp           TEXT NOT NULL,
  request_id          TEXT NOT NULL,
  original_model      TEXT NOT NULL,
  routed_model        TEXT NOT NULL,
  routed_provider     TEXT NOT NULL,
  task_tier           TEXT NOT NULL,
  compaction_applied  INTEGER NOT NULL,
  tokens_prompt       INTEGER NOT NULL,
  tokens_completion   INTEGER NOT NULL,
  tokens_total        INTEGER NOT NULL,
  cost_original_usd   REAL NOT NULL,
  cost_routed_usd     REAL NOT NULL,
  cost_savings_usd    REAL NOT NULL,
  latency_classify_ms  REAL NOT NULL,
  latency_compact_ms   REAL NOT NULL,
  latency_route_ms     REAL NOT NULL,
  latency_upstream_ms  REAL NOT NULL,
  latency_total_ms     REAL NOT NULL,
  upstream_status      INTEGER,
  error                TEXT
);`;

const CREATE_INDEXES_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON request_traces(timestamp);',
  'CREATE INDEX IF NOT EXISTS idx_traces_tier ON request_traces(task_tier);',
  'CREATE INDEX IF NOT EXISTS idx_traces_model ON request_traces(routed_model);',
  'CREATE INDEX IF NOT EXISTS idx_traces_latency ON request_traces(latency_total_ms);',
];

const INSERT_SQL = `
INSERT INTO request_traces (
  id, timestamp, request_id, original_model, routed_model, routed_provider,
  task_tier, compaction_applied, tokens_prompt, tokens_completion, tokens_total,
  cost_original_usd, cost_routed_usd, cost_savings_usd,
  latency_classify_ms, latency_compact_ms, latency_route_ms,
  latency_upstream_ms, latency_total_ms, upstream_status, error
) VALUES (
  @id, @timestamp, @request_id, @original_model, @routed_model, @routed_provider,
  @task_tier, @compaction_applied, @tokens_prompt, @tokens_completion, @tokens_total,
  @cost_original_usd, @cost_routed_usd, @cost_savings_usd,
  @latency_classify_ms, @latency_compact_ms, @latency_route_ms,
  @latency_upstream_ms, @latency_total_ms, @upstream_status, @error
);`;

/**
 * Create a no-op telemetry store that silently discards all writes.
 * @returns A TelemetryStore that does nothing
 */
function createNoOpStore(): TelemetryStore {
  return {
    insertTrace: () => {},
    queryByTimeRange: () => [],
    queryByTier: () => [],
    queryByModel: () => [],
    querySlowRequests: () => [],
    getStats: () => ({
      totalTraces: 0,
      tracesByTier: {},
      avgLatencyMs: 0,
      totalSavingsUsd: 0,
    }),
    close: () => {},
    getDb: () => null,
  };
}

/**
 * Create a telemetry store backed by SQLite.
 * If initialization fails, returns a no-op store. The proxy continues unaffected.
 * @param dbPath - Path to the SQLite database file
 * @returns A TelemetryStore instance
 */
export function createStore(dbPath: string): TelemetryStore {
  let db: Database.Database;

  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_TABLE_SQL);
    for (const sql of CREATE_INDEXES_SQL) {
      db.exec(sql);
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `${JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        message: `Telemetry store init failed: ${detail}. Falling back to no-op store.`,
      })}\n`,
    );
    return createNoOpStore();
  }

  const insertStmt = db.prepare(INSERT_SQL);

  return {
    insertTrace(trace: RequestTrace): void {
      insertStmt.run(traceToRow(trace));
    },

    queryByTimeRange(from: string, to: string): RequestTrace[] {
      const rows = db
        .prepare(
          'SELECT * FROM request_traces WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp',
        )
        .all(toUtcIso(from), toUtcIso(to)) as FlatRow[];
      return rows.map(rowToTrace);
    },

    queryByTier(tier: string): RequestTrace[] {
      const rows = db
        .prepare('SELECT * FROM request_traces WHERE task_tier = ? ORDER BY timestamp')
        .all(tier) as FlatRow[];
      return rows.map(rowToTrace);
    },

    queryByModel(model: string): RequestTrace[] {
      const rows = db
        .prepare('SELECT * FROM request_traces WHERE routed_model = ? ORDER BY timestamp')
        .all(model) as FlatRow[];
      return rows.map(rowToTrace);
    },

    querySlowRequests(thresholdMs: number): RequestTrace[] {
      const rows = db
        .prepare(
          'SELECT * FROM request_traces WHERE latency_total_ms > ? ORDER BY latency_total_ms DESC',
        )
        .all(thresholdMs) as FlatRow[];
      return rows.map(rowToTrace);
    },

    getStats(): TelemetryStats {
      const countRow = db.prepare('SELECT COUNT(*) as cnt FROM request_traces').get() as {
        cnt: number;
      };
      const avgRow = db
        .prepare('SELECT COALESCE(AVG(latency_total_ms), 0) as avg_lat FROM request_traces')
        .get() as { avg_lat: number };
      const savingsRow = db
        .prepare('SELECT COALESCE(SUM(cost_savings_usd), 0) as total_sav FROM request_traces')
        .get() as { total_sav: number };
      const tierRows = db
        .prepare('SELECT task_tier, COUNT(*) as cnt FROM request_traces GROUP BY task_tier')
        .all() as { task_tier: string; cnt: number }[];

      const tracesByTier: Record<string, number> = {};
      for (const row of tierRows) {
        tracesByTier[row.task_tier] = row.cnt;
      }

      return {
        totalTraces: countRow.cnt,
        tracesByTier,
        avgLatencyMs: avgRow.avg_lat,
        totalSavingsUsd: savingsRow.total_sav,
      };
    },

    close(): void {
      db.close();
    },

    getDb(): import('better-sqlite3').Database | null {
      return db;
    },
  };
}
