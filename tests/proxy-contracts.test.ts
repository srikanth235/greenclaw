import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, startServer } from '../packages/api/src/index.js';
import type { GreenClawConfig } from '../packages/config/src/index.js';
import { createLogger, createStore, type TelemetryStore } from '../packages/telemetry/src/index.js';

type RunningServer = {
  baseUrl: string;
  close(): Promise<void>;
};

const openStores: TelemetryStore[] = [];

afterEach(() => {
  while (openStores.length > 0) {
    const store = openStores.pop();
    if (store) {
      const db = store.getDb();
      const fileName = db?.name;
      store.close();
      if (fileName && typeof fileName === 'string' && fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
      }
    }
  }
});

/**
 * Start a simple Node HTTP server on an ephemeral port.
 * @param handler - Request handler
 * @returns Running server wrapper
 */
function startHttpServer(handler: http.RequestListener): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to resolve test server address');
      }

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}

/**
 * Read the full request body as text.
 * @param request - Incoming Node request
 * @returns Request body text
 */
function readBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    request.on('error', reject);
  });
}

/**
 * Build test config for a proxy instance.
 * @param upstreamBaseUrl - Base URL of the mock upstream
 * @param telemetryDbPath - Temp SQLite path
 * @returns GreenClaw config object
 */
function makeConfig(upstreamBaseUrl: string, telemetryDbPath: string): GreenClawConfig {
  return {
    telemetryDbPath,
    port: 0,
    logLevel: 'info',
    upstreamBaseUrl,
    routingModels: {
      HEARTBEAT: { provider: 'openai', model: 'gpt-4o-mini' },
      SIMPLE: { provider: 'openai', model: 'gpt-4o-mini' },
      MODERATE: { provider: 'openai', model: 'gpt-4o' },
      COMPLEX: { provider: 'openai', model: 'gpt-4.1' },
    },
  };
}

/**
 * Start a GreenClaw proxy server pointed at a mock upstream.
 * @param upstreamBaseUrl - Base URL for upstream forwarding
 * @returns Proxy server and telemetry store
 */
async function startProxy(
  upstreamBaseUrl: string,
): Promise<{ server: Awaited<ReturnType<typeof startServer>>; store: TelemetryStore }> {
  const dbPath = path.join(os.tmpdir(), `greenclaw-proxy-${Date.now()}-${Math.random()}.db`);
  const store = createStore(dbPath);
  openStores.push(store);
  let requestCounter = 0;
  const logger = createLogger({
    level: 'info',
    destination: new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }),
  });
  const config = makeConfig(upstreamBaseUrl, dbPath);
  const app = createApp({
    config,
    fetchImpl: fetch,
    telemetryStore: store,
    logger,
    now: () => Date.parse('2026-03-13T00:00:00.000Z'),
    requestId: () => {
      requestCounter += 1;
      return `req-${requestCounter}`;
    },
    version: '0.1.0',
  });

  const server = await startServer({ app, hostname: '127.0.0.1', port: 0 });
  return { server, store };
}

describe('Proxy Contract: Upstream Passthrough Parity', () => {
  it('forwards upstream JSON response unchanged', async () => {
    const upstreamBody = JSON.stringify({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1710000000,
      model: 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const upstream = await startHttpServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json', 'x-upstream': 'mock' });
      response.end(upstreamBody);
    });
    const { server, store } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const response = await fetch(`${proxyBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'auto',
          messages: [{ role: 'user', content: 'What is the capital of France?' }],
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(response.headers.get('x-upstream')).toBe('mock');
      expect(await response.text()).toBe(upstreamBody);
      expect(store.getStats().totalTraces).toBe(1);
    } finally {
      await server.close();
      await upstream.close();
    }
  });

  it('forwards upstream error responses unchanged', async () => {
    const errorBody = JSON.stringify({
      error: { message: 'Rate limited', type: 'rate_limit_error', param: null, code: null },
    });
    const upstream = await startHttpServer((_request, response) => {
      response.writeHead(429, { 'content-type': 'application/json' });
      response.end(errorBody);
    });
    const { server, store } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const response = await fetch(`${proxyBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'auto',
          messages: [{ role: 'user', content: 'What is the weather in Austin?' }],
        }),
      });

      expect(response.status).toBe(429);
      expect(await response.text()).toBe(errorBody);
      expect(store.getStats().totalTraces).toBe(1);
    } finally {
      await server.close();
      await upstream.close();
    }
  });

  it('forwards SSE chunks byte-for-byte without rewriting', async () => {
    const chunks = ['data: {"delta":"one"}\n\n', 'data: {"delta":"two"}\n\n', 'data: [DONE]\n\n'];
    const upstream = await startHttpServer((_request, response) => {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      for (const chunk of chunks) {
        response.write(chunk);
      }
      response.end();
    });
    const { server, store } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const response = await fetch(`${proxyBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'auto',
          stream: true,
          messages: [{ role: 'system', content: 'HEARTBEAT check agent.' }],
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(await response.text()).toBe(chunks.join(''));
      expect(store.getStats().totalTraces).toBe(1);
    } finally {
      await server.close();
      await upstream.close();
    }
  });
});

describe('Proxy Contract: Only Model Mutates', () => {
  it('preserves all request fields except model', async () => {
    const upstream = await startHttpServer(async (request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(await readBody(request));
    });
    const { server } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const request = {
        model: 'auto',
        messages: [{ role: 'user', content: 'What meetings do I have tomorrow?' }],
        temperature: 0.7,
        max_tokens: 100,
        stream: false,
      };

      const response = await fetch(`${proxyBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const echoed = (await response.json()) as Record<string, unknown>;

      expect(echoed.model).toBe('gpt-4o-mini');
      expect(echoed.messages).toEqual(request.messages);
      expect(echoed.temperature).toBe(request.temperature);
      expect(echoed.max_tokens).toBe(request.max_tokens);
      expect(echoed.stream).toBe(request.stream);
    } finally {
      await server.close();
      await upstream.close();
    }
  });

  it('does not modify non-model fields in the forwarded request', async () => {
    const upstream = await startHttpServer(async (request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(await readBody(request));
    });
    const { server } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const request = {
        model: 'greenclaw/auto',
        messages: [{ role: 'user', content: 'Check my inbox and draft a reply to urgent emails.' }],
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
        user: 'test-user-123',
        metadata: { source: 'proxy-contract-test' },
      };

      const response = await fetch(`${proxyBaseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-request-id': 'req-contract' },
        body: JSON.stringify(request),
      });
      const echoed = (await response.json()) as Record<string, unknown>;
      const { model: _ignoredModel, ...rest } = request;
      const { model: _ignoredEchoedModel, ...echoedRest } = echoed as typeof echoed & {
        model: string;
      };

      expect((echoed as { model: string }).model).toBe('gpt-4o');
      expect(echoedRest).toEqual(rest);
    } finally {
      await server.close();
      await upstream.close();
    }
  });
});

describe('Proxy Contract: Boot Smoke Test', () => {
  it('/health returns documented shape and is not traced', async () => {
    const upstream = await startHttpServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    });
    const { server, store } = await startProxy(upstream.baseUrl);
    const proxyBaseUrl = `http://127.0.0.1:${server.port}`;

    try {
      const response = await fetch(`${proxyBaseUrl}/health`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(typeof body.version).toBe('string');
      expect(typeof body.uptime).toBe('number');
      expect(store.getStats().totalTraces).toBe(0);
    } finally {
      await server.close();
      await upstream.close();
    }
  });
});
