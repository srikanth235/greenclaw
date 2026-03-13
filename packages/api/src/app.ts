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
  const defaults = createDefaultDependencies();
  const dependencies: AppDependencies = {
    ...defaults,
    ...input,
    now: input?.now ?? defaults.now,
    requestId: input?.requestId ?? defaults.requestId,
    version: input?.version ?? defaults.version,
  };

  const app = new Hono();
  const startedAt = dependencies.now?.() ?? Date.now();
  let tracesEmitted = 0;

  app.get('/health', (context) => {
    const response = HealthResponseSchema.parse({
      status: 'ok',
      version: dependencies.version ?? '0.1.0',
      uptime: Math.floor(((dependencies.now?.() ?? Date.now()) - startedAt) / 1000),
      traces_emitted: tracesEmitted,
    });
    return context.json(response, 200);
  });

  app.post('/v1/chat/completions', async (context) => {
    const requestId =
      context.req.header('x-request-id') ?? dependencies.requestId?.() ?? randomUUID();
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
    const compactedMessages = compact(request.messages, Number.POSITIVE_INFINITY);
    const routed = route(taskTier, dependencies.config, request.model);
    const forwardedBody = JSON.stringify({
      ...request,
      messages: compactedMessages,
      model: routed.model,
    });

    try {
      const headers = new Headers(context.req.raw.headers);
      headers.delete('content-length');

      const upstreamResponse = await dependencies.fetchImpl(
        `${dependencies.config.upstreamBaseUrl}${requestUrl.pathname}${requestUrl.search}`,
        {
          method: context.req.method,
          headers,
          body: forwardedBody,
          signal: context.req.raw.signal,
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
          compactionApplied: compactedMessages !== request.messages,
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
          compactionApplied: compactedMessages !== request.messages,
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
