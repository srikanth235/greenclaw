/**
 * GreenClaw API application factory.
 * @module @greenclaw/api/app
 */

import { randomUUID } from 'node:crypto';
import type { GreenClawConfig } from '@greenclaw/config';
import { loadConfig } from '@greenclaw/config';
import { classify, compact, route } from '@greenclaw/optimization';
import { createLogger, createStore, type TelemetryStore } from '@greenclaw/telemetry';
import {
  ChatCompletionRequestSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
} from '@greenclaw/types';
import { Hono } from 'hono';
import { emitTrace } from './trace.js';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AppLogger = Pick<ReturnType<typeof createLogger>, 'info' | 'warn' | 'error'>;

/** Default upstream request timeout in milliseconds (30 seconds). */
const UPSTREAM_TIMEOUT_MS = 30_000;

/**
 * Headers that must not be forwarded to the upstream provider.
 * Includes hop-by-hop headers (RFC 2616 §13.5.1) and sensitive headers.
 */
const STRIPPED_HEADERS = [
  'content-length',
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'cookie',
];

/** Dependencies required to construct the GreenClaw app. */
export interface AppDependencies {
  config: GreenClawConfig;
  fetchImpl: FetchLike;
  telemetryStore: TelemetryStore;
  logger: AppLogger;
  now: () => number;
  requestId: () => string;
  version: string;
}

/**
 * Build a default dependency bundle from runtime config.
 * @returns Default app dependencies
 */
export function createDefaultDependencies(): AppDependencies {
  const config = loadConfig();
  return {
    config,
    fetchImpl: fetch,
    telemetryStore: createStore(config.telemetryDbPath),
    logger: createLogger({ level: config.logLevel }),
    now: () => Date.now(),
    requestId: () => randomUUID(),
    version: '0.1.0',
  };
}

/**
 * Create the GreenClaw Hono application.
 * @param input - Optional injected dependencies for tests and embedding
 * @returns Hono application exposing proxy and health routes
 */
export function createApp(input?: Partial<AppDependencies>): Hono {
  const allKeysProvided =
    input?.config &&
    input?.fetchImpl &&
    input?.telemetryStore &&
    input?.logger &&
    input?.now &&
    input?.requestId &&
    input?.version;

  const dependencies: AppDependencies = allKeysProvided
    ? (input as AppDependencies)
    : { ...createDefaultDependencies(), ...input };

  const app = new Hono();
  const startedAt = dependencies.now();
  let tracesEmitted = 0;

  app.get('/health', (context) => {
    const response = HealthResponseSchema.parse({
      status: 'ok',
      version: dependencies.version,
      uptime: Math.floor((dependencies.now() - startedAt) / 1000),
      traces_emitted: tracesEmitted,
    });
    return context.json(response, 200);
  });

  app.post('/v1/chat/completions', async (context) => {
    const requestId = context.req.header('x-request-id') ?? dependencies.requestId();
    const rawBody = await context.req.text();
    const requestUrl = new URL(context.req.url);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      const error = ErrorResponseSchema.parse({
        error: {
          message: 'Invalid request: JSON body is required',
          type: 'invalid_request_error',
          param: 'body',
          code: null,
        },
      });
      emitTrace(
        dependencies,
        {
          requestId,
          originalModel: 'unknown',
          routedModel: 'unknown',
          routedProvider: 'openai',
          taskTier: 'SIMPLE',
          upstreamStatus: null,
          error: error.error.message,
          compactionApplied: false,
        },
        () => {
          tracesEmitted += 1;
        },
      );
      return context.json(error, 400);
    }

    const parsedRequest = ChatCompletionRequestSchema.safeParse(parsedJson);
    if (!parsedRequest.success) {
      const originalModel =
        typeof parsedJson === 'object' &&
        parsedJson !== null &&
        'model' in parsedJson &&
        typeof (parsedJson as { model?: unknown }).model === 'string'
          ? (parsedJson as { model: string }).model
          : 'unknown';
      const error = ErrorResponseSchema.parse({
        error: {
          message: 'Invalid request: messages array is required',
          type: 'invalid_request_error',
          param: 'messages',
          code: null,
        },
      });
      emitTrace(
        dependencies,
        {
          requestId,
          originalModel,
          routedModel: originalModel,
          routedProvider: dependencies.config.routingModels.SIMPLE.provider,
          taskTier: 'SIMPLE',
          upstreamStatus: null,
          error: error.error.message,
          compactionApplied: false,
        },
        () => {
          tracesEmitted += 1;
        },
      );
      return context.json(error, 400);
    }

    const request = parsedRequest.data;
    const taskTier = classify(request.messages, request.model);
    const compactResult = compact(request.messages, Number.POSITIVE_INFINITY);
    const routed = route(taskTier, dependencies.config, request.model);
    const forwardedBody = JSON.stringify({
      ...request,
      messages: compactResult.messages,
      model: routed.model,
    });

    try {
      const headers = new Headers(context.req.raw.headers);
      for (const name of STRIPPED_HEADERS) {
        headers.delete(name);
      }

      const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
      const clientSignal = context.req.raw.signal;
      const signal = clientSignal ? AbortSignal.any([clientSignal, timeoutSignal]) : timeoutSignal;

      const upstreamResponse = await dependencies.fetchImpl(
        `${dependencies.config.upstreamBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
        {
          method: context.req.method,
          headers,
          body: forwardedBody,
          signal,
        },
      );

      emitTrace(
        dependencies,
        {
          requestId,
          originalModel: request.model,
          routedModel: routed.model,
          routedProvider: routed.provider,
          taskTier,
          upstreamStatus: upstreamResponse.status,
          error: null,
          compactionApplied: compactResult.applied,
        },
        () => {
          tracesEmitted += 1;
        },
      );

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: new Headers(upstreamResponse.headers),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      emitTrace(
        dependencies,
        {
          requestId,
          originalModel: request.model,
          routedModel: routed.model,
          routedProvider: routed.provider,
          taskTier,
          upstreamStatus: null,
          error: detail,
          compactionApplied: compactResult.applied,
        },
        () => {
          tracesEmitted += 1;
        },
      );

      const response = ErrorResponseSchema.parse({
        error: {
          message: 'Upstream request failed',
          type: 'api_connection_error',
          param: null,
          code: null,
        },
      });
      return context.json(response, 502);
    }
  });

  return app;
}
