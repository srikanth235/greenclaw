/**
 * Trace emission helpers for the API layer.
 * @module @greenclaw/api/trace
 */

import type { RequestTrace } from '@greenclaw/types';
import type { AppDependencies } from './app.js';

/** Inputs required to emit a RequestTrace from the API layer. */
export type TraceInput = {
  requestId: string;
  originalModel: string;
  routedModel: string;
  routedProvider: string;
  taskTier: RequestTrace['task_tier'];
  upstreamStatus: number | null;
  error: string | null;
  compactionApplied: boolean;
};

/**
 * Persist and log a RequestTrace for a proxied request.
 * @param dependencies - API dependencies used for persistence and logging
 * @param input - Trace field values
 * @param afterInsert - Callback invoked after a successful insert
 */
export function emitTrace(
  dependencies: AppDependencies,
  input: TraceInput,
  afterInsert: () => void,
): void {
  const trace: RequestTrace = {
    id: `${input.requestId}-trace`,
    timestamp: new Date(dependencies.now()).toISOString(),
    request_id: input.requestId,
    original_model: input.originalModel,
    routed_model: input.routedModel,
    routed_provider: input.routedProvider,
    task_tier: input.taskTier,
    compaction_applied: input.compactionApplied,
    tokens: {
      prompt: 0,
      completion: 0,
      total: 0,
    },
    estimated_cost: {
      original_usd: 0,
      routed_usd: 0,
      savings_usd: 0,
    },
    latency_ms: {
      classify: 0,
      compact: 0,
      route: 0,
      upstream: 0,
      total: 0,
    },
    upstream_status: input.upstreamStatus,
    error: input.error,
  };

  try {
    dependencies.telemetryStore.insertTrace(trace);
    afterInsert();
  } catch (insertError) {
    dependencies.logger.error(
      {
        request_id: input.requestId,
        data: { error: insertError instanceof Error ? insertError.message : String(insertError) },
      },
      'Failed to persist trace',
    );
  }
  if (input.error) {
    dependencies.logger.warn(
      {
        request_id: input.requestId,
        data: { routed_model: input.routedModel, error: input.error },
      },
      'Request failed',
    );
    return;
  }

  dependencies.logger.info(
    {
      request_id: input.requestId,
      data: {
        task_tier: input.taskTier,
        routed_model: input.routedModel,
        upstream_status: input.upstreamStatus,
      },
    },
    'Request proxied',
  );
}
