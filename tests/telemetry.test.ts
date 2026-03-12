import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createStore, type RequestTrace, type TelemetryStore } from '../src/telemetry/store.js';
import { createLogger } from '../src/telemetry/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

/**
 * Create a mock RequestTrace with sensible defaults and optional overrides.
 * @param overrides - Partial fields to override
 * @returns A valid RequestTrace
 */
function mockTrace(overrides: Partial<RequestTrace> = {}): RequestTrace {
  counter += 1;
  return {
    id: `trace-${counter}`,
    timestamp: '2026-03-12T10:00:00.000Z',
    request_id: `req-${counter}`,
    original_model: 'gpt-4o',
    routed_model: 'gpt-4o-mini',
    routed_provider: 'openai',
    task_tier: 'SIMPLE',
    compaction_applied: false,
    tokens: { prompt: 100, completion: 50, total: 150 },
    estimated_cost: { original_usd: 0.01, routed_usd: 0.002, savings_usd: 0.008 },
    latency_ms: { classify: 1, compact: 0, route: 1, upstream: 200, total: 202 },
    upstream_status: 200,
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Store tests
// ---------------------------------------------------------------------------

describe('Telemetry: Store', () => {
  let dbPath: string;
  let store: TelemetryStore;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `greenclaw-test-${Date.now()}-${counter}.db`);
    store = createStore(dbPath);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('creates the database file on init', () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('inserts and retrieves a trace by time range', () => {
    const trace = mockTrace({ timestamp: '2026-03-12T10:00:00.000Z' });
    store.insertTrace(trace);
    const results = store.queryByTimeRange('2026-03-12T00:00:00Z', '2026-03-13T00:00:00Z');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(trace.id);
  });

  it('queries by task tier', () => {
    store.insertTrace(mockTrace({ task_tier: 'HEARTBEAT' }));
    store.insertTrace(mockTrace({ task_tier: 'COMPLEX' }));
    store.insertTrace(mockTrace({ task_tier: 'HEARTBEAT' }));

    const heartbeats = store.queryByTier('HEARTBEAT');
    expect(heartbeats).toHaveLength(2);

    const complex = store.queryByTier('COMPLEX');
    expect(complex).toHaveLength(1);
  });

  it('queries by routed model', () => {
    store.insertTrace(mockTrace({ routed_model: 'gpt-4o-mini' }));
    store.insertTrace(mockTrace({ routed_model: 'gpt-4o' }));
    store.insertTrace(mockTrace({ routed_model: 'gpt-4o-mini' }));

    const results = store.queryByModel('gpt-4o-mini');
    expect(results).toHaveLength(2);
  });

  it('queries slow requests above threshold', () => {
    store.insertTrace(
      mockTrace({ latency_ms: { classify: 1, compact: 0, route: 1, upstream: 498, total: 500 } }),
    );
    store.insertTrace(
      mockTrace({
        latency_ms: { classify: 1, compact: 0, route: 1, upstream: 1998, total: 2000 },
      }),
    );
    store.insertTrace(
      mockTrace({ latency_ms: { classify: 1, compact: 0, route: 1, upstream: 98, total: 100 } }),
    );

    const slow = store.querySlowRequests(1000);
    expect(slow).toHaveLength(1);
    expect(slow[0]!.latency_ms.total).toBe(2000);
  });

  it('returns aggregated stats', () => {
    store.insertTrace(
      mockTrace({
        task_tier: 'SIMPLE',
        estimated_cost: { original_usd: 0.01, routed_usd: 0.002, savings_usd: 0.008 },
        latency_ms: { classify: 1, compact: 0, route: 1, upstream: 198, total: 200 },
      }),
    );
    store.insertTrace(
      mockTrace({
        task_tier: 'COMPLEX',
        estimated_cost: { original_usd: 0.05, routed_usd: 0.01, savings_usd: 0.04 },
        latency_ms: { classify: 2, compact: 5, route: 1, upstream: 392, total: 400 },
      }),
    );

    const stats = store.getStats();
    expect(stats.totalTraces).toBe(2);
    expect(stats.tracesByTier['SIMPLE']).toBe(1);
    expect(stats.tracesByTier['COMPLEX']).toBe(1);
    expect(stats.avgLatencyMs).toBe(300);
    expect(stats.totalSavingsUsd).toBeCloseTo(0.048, 3);
  });

  it('returns empty stats when no traces exist', () => {
    const stats = store.getStats();
    expect(stats.totalTraces).toBe(0);
    expect(stats.tracesByTier).toEqual({});
    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.totalSavingsUsd).toBe(0);
  });

  it('preserves boolean compaction_applied through round-trip', () => {
    store.insertTrace(mockTrace({ compaction_applied: true }));
    store.insertTrace(mockTrace({ compaction_applied: false }));

    const results = store.queryByTimeRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
    const compacted = results.filter((r) => r.compaction_applied);
    const notCompacted = results.filter((r) => !r.compaction_applied);
    expect(compacted).toHaveLength(1);
    expect(notCompacted).toHaveLength(1);
  });

  it('preserves nullable fields through round-trip', () => {
    store.insertTrace(mockTrace({ upstream_status: null, error: 'timeout' }));
    const results = store.queryByTimeRange('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z');
    expect(results[0]!.upstream_status).toBeNull();
    expect(results[0]!.error).toBe('timeout');
  });

  it('falls back to no-op store on invalid path', () => {
    const noOpStore = createStore('/nonexistent/deeply/nested/path/db.sqlite');
    expect(() => noOpStore.insertTrace(mockTrace())).not.toThrow();
    expect(noOpStore.queryByTier('SIMPLE')).toEqual([]);
    expect(noOpStore.getStats().totalTraces).toBe(0);
    noOpStore.close();
  });
});

// ---------------------------------------------------------------------------
// Logger tests
// ---------------------------------------------------------------------------

describe('Telemetry: Logger', () => {
  it('creates a Pino logger with the configured level', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('defaults name to greenclaw', () => {
    const logger = createLogger({ level: 'info' });
    expect(logger.bindings().name).toBe('greenclaw');
  });

  it('uses custom name when provided', () => {
    const logger = createLogger({ level: 'info', name: 'test-app' });
    expect(logger.bindings().name).toBe('test-app');
  });
});
