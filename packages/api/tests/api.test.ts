import { Writable } from 'node:stream';
import { createApp } from '@greenclaw/api';
import type { GreenClawConfig } from '@greenclaw/config';
import { createLogger, createStore } from '@greenclaw/telemetry';
import { afterEach, describe, expect, it } from 'vitest';

const TEST_CONFIG: GreenClawConfig = {
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

const silentLogger = createLogger({
  level: 'info',
  destination: new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  }),
});

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
    const app = createApp({
      config: TEST_CONFIG,
      fetchImpl: fetch,
      telemetryStore: store,
      logger: silentLogger,
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

  it('returns 400 for invalid JSON body', async () => {
    const store = createStore(':memory:');
    stores.push(store);
    const app = createApp({
      config: TEST_CONFIG,
      fetchImpl: fetch,
      telemetryStore: store,
      logger: silentLogger,
      now: () => Date.parse('2026-03-13T00:00:00.000Z'),
      requestId: () => 'req-bad-json',
      version: '0.1.0',
    });

    const response = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    });
    const body = (await response.json()) as { error: { message: string; type: string } };

    expect(response.status).toBe(400);
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('JSON body');
    expect(store.getStats().totalTraces).toBe(1);
  });

  it('returns 400 when messages array is missing', async () => {
    const store = createStore(':memory:');
    stores.push(store);
    const app = createApp({
      config: TEST_CONFIG,
      fetchImpl: fetch,
      telemetryStore: store,
      logger: silentLogger,
      now: () => Date.parse('2026-03-13T00:00:00.000Z'),
      requestId: () => 'req-no-messages',
      version: '0.1.0',
    });

    const response = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o' }),
    });
    const body = (await response.json()) as { error: { message: string; type: string } };

    expect(response.status).toBe(400);
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('messages');
    expect(store.getStats().totalTraces).toBe(1);
  });

  it('returns 502 when upstream fetch fails', async () => {
    const store = createStore(':memory:');
    stores.push(store);
    const app = createApp({
      config: TEST_CONFIG,
      fetchImpl: () => Promise.reject(new Error('connection refused')),
      telemetryStore: store,
      logger: silentLogger,
      now: () => Date.parse('2026-03-13T00:00:00.000Z'),
      requestId: () => 'req-502',
      version: '0.1.0',
    });

    const response = await app.request('/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    const body = (await response.json()) as { error: { message: string; type: string } };

    expect(response.status).toBe(502);
    expect(body.error.type).toBe('api_connection_error');
    expect(body.error.message).toBe('Upstream request failed');
    expect(store.getStats().totalTraces).toBe(1);
  });
});
