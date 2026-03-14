import { createStore } from '@greenclaw/telemetry';
import { afterEach, describe, expect, it } from 'vitest';
import { createUsageStore } from '../src/index.js';

describe('monitoring', () => {
  const stores: ReturnType<typeof createStore>[] = [];

  afterEach(() => {
    while (stores.length > 0) {
      stores.pop()?.close();
    }
  });

  it('creates a no-op usage store when telemetry DB is unavailable', () => {
    const usageStore = createUsageStore(null);
    expect(usageStore.summary('day').request_count).toBe(0);
    expect(usageStore.breakdown('model', 'day')).toEqual([]);
  });

  it('aggregates request traces from the shared telemetry DB', () => {
    const store = createStore(':memory:');
    stores.push(store);
    store.insertTrace({
      id: 'trace-1',
      timestamp: new Date().toISOString(),
      request_id: 'req-1',
      original_model: 'auto',
      routed_model: 'gpt-4o-mini',
      routed_provider: 'openai',
      task_tier: 'SIMPLE',
      compaction_applied: false,
      tokens: { prompt: 10, completion: 5, total: 15 },
      estimated_cost: { original_usd: 0.01, routed_usd: 0.002, savings_usd: 0.008 },
      latency_ms: { classify: 1, compact: 0, route: 1, upstream: 10, total: 12 },
      upstream_status: 200,
      error: null,
    });

    const usageStore = createUsageStore(store.getDb());
    expect(usageStore.summary('day').request_count).toBe(1);
    expect(usageStore.breakdown('model', 'day')[0]?.group_key).toBe('gpt-4o-mini');
  });
});
