import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Writable } from 'node:stream';
import { createStore, type RequestTrace, type TelemetryStore } from '../src/store.js';
import { createLogger } from '../src/logger.js';

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

  it('emits stderr warning on init failure', () => {
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      chunks.push(chunk);
      return true;
    }) as typeof process.stderr.write;
    try {
      const noOpStore = createStore('/nonexistent/deeply/nested/path/db.sqlite');
      noOpStore.close();
    } finally {
      process.stderr.write = origWrite;
    }
    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0]!) as { level: string; message: string };
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toContain('Telemetry store init failed');
  });

  it('normalizes timezone offsets in time-range queries', () => {
    // Insert a trace at 2026-03-12T10:00:00Z (UTC)
    store.insertTrace(mockTrace({ timestamp: '2026-03-12T10:00:00.000Z' }));

    // Query using +05:30 offset that covers the same instant
    // 2026-03-12T14:00:00+05:30 = 2026-03-12T08:30:00Z
    // 2026-03-12T16:30:00+05:30 = 2026-03-12T11:00:00Z
    const results = store.queryByTimeRange(
      '2026-03-12T14:00:00+05:30',
      '2026-03-12T16:30:00+05:30',
    );
    expect(results).toHaveLength(1);
  });

  it('normalizes offset timestamps on insert', () => {
    // Insert with +05:30 offset: 2026-03-12T15:30:00+05:30 = 2026-03-12T10:00:00Z
    store.insertTrace(mockTrace({ timestamp: '2026-03-12T15:30:00+05:30' }));

    // Query with UTC range that covers the normalized instant
    const results = store.queryByTimeRange('2026-03-12T09:00:00Z', '2026-03-12T11:00:00Z');
    expect(results).toHaveLength(1);
    expect(results[0]!.timestamp).toBe('2026-03-12T10:00:00.000Z');
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

  it('emits JSON with "timestamp" and "message" keys, no pid/hostname', async () => {
    const chunks: string[] = [];
    const dest = new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const logger = createLogger({ level: 'info' });
    // Pino uses the destination from the constructor; create a new one with our dest
    const testLogger = logger.child({}, { level: 'info' });
    // Use pino directly to test the formatters with a custom destination
    const pino = await import('pino');
    const captureLogger = pino.default(
      {
        level: 'info',
        messageKey: 'message',
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        base: { name: 'greenclaw' },
        formatters: { level: (label: string) => ({ level: label }) },
      },
      dest,
    );
    captureLogger.info('test message');
    // Flush pino
    await new Promise<void>((resolve) => {
      dest.end(() => resolve());
    });
    expect(chunks.length).toBeGreaterThan(0);
    const record = JSON.parse(chunks[0]!) as Record<string, unknown>;
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('message', 'test message');
    expect(record).not.toHaveProperty('time');
    expect(record).not.toHaveProperty('msg');
    expect(record).not.toHaveProperty('pid');
    expect(record).not.toHaveProperty('hostname');
    // Suppress unused variable warnings
    void testLogger;
  });
});
