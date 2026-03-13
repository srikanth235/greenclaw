import { createApp } from '@greenclaw/api';
import type { GreenClawConfig } from '@greenclaw/config';
import { createLogger, createStore } from '@greenclaw/telemetry';
import { afterEach, describe, expect, it } from 'vitest';

describe('api', () => {
  const stores: ReturnType<typeof createStore>[] = [];

  afterEach(() => {
    while (stores.length > 0) {
      const store = stores.pop();
      store?.close();
    }
  });

  it('serves health without tracing it', async () => {
    const store = createStore(':memory:');
    stores.push(store);
    const config: GreenClawConfig = {
      telemetryDbPath: ':memory:',
      port: 0,
      logLevel: 'info',
      upstreamBaseUrl: 'http://127.0.0.1:4000',
      routingModels: {
        HEARTBEAT: { provider: 'openai', model: 'gpt-4o-mini' },
        SIMPLE: { provider: 'openai', model: 'gpt-4o-mini' },
        MODERATE: { provider: 'openai', model: 'gpt-4o' },
        COMPLEX: { provider: 'openai', model: 'gpt-4.1' },
      },
    };
    const app = createApp({
      config,
      fetchImpl: fetch,
      telemetryStore: store,
      logger: createLogger({ level: 'info' }),
      now: () => Date.parse('2026-03-13T00:00:00.000Z'),
      requestId: () => 'req-api-test',
      version: '0.1.0',
    });

    const response = await app.request('/health');
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(store.getStats().totalTraces).toBe(0);
  });
});
