import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Golden file tests — validate that API response shapes match the
 * expected contract. These catch accidental schema drift.
 *
 * Golden files live in tests/fixtures/golden-responses.json and define
 * the canonical shape of every response type GreenClaw emits.
 *
 * Currently skipped because Zod schemas are stubs. Once types/ is
 * implemented, these tests import the schemas and validate the golden
 * files against them.
 */

const GOLDEN_PATH = path.resolve(__dirname, 'fixtures', 'golden-responses.json');

interface GoldenFile {
  chat_completion_response: Record<string, unknown>;
  chat_completion_response_streaming_chunk: Record<string, unknown>;
  health_response: Record<string, unknown>;
  error_response: Record<string, unknown>;
  request_trace: Record<string, unknown>;
}

describe('Golden file: response shape contracts', () => {
  const golden: GoldenFile = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'));

  it('golden file is valid JSON with all expected keys', () => {
    expect(golden).toHaveProperty('chat_completion_response');
    expect(golden).toHaveProperty('chat_completion_response_streaming_chunk');
    expect(golden).toHaveProperty('health_response');
    expect(golden).toHaveProperty('error_response');
    expect(golden).toHaveProperty('request_trace');
  });

  it.skip('chat_completion_response matches ChatCompletionResponseSchema', () => {
    // TODO: import { ChatCompletionResponseSchema } from '../src/types/index.js';
    // const result = ChatCompletionResponseSchema.safeParse(golden.chat_completion_response);
    // expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it.skip('error_response matches ErrorResponseSchema', () => {
    // TODO: import { ErrorResponseSchema } from '../src/types/index.js';
    // const result = ErrorResponseSchema.safeParse(golden.error_response);
    // expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it.skip('request_trace matches RequestTraceSchema', () => {
    // TODO: import { RequestTraceSchema } from '../src/types/index.js';
    // const result = RequestTraceSchema.safeParse(golden.request_trace);
    // expect(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
  });

  it('chat_completion_response has required OpenAI-compatible fields', () => {
    const resp = golden.chat_completion_response;
    expect(resp).toHaveProperty('id');
    expect(resp).toHaveProperty('object', 'chat.completion');
    expect(resp).toHaveProperty('created');
    expect(resp).toHaveProperty('model');
    expect(resp).toHaveProperty('choices');
    expect(resp).toHaveProperty('usage');
  });

  it('streaming chunk has required OpenAI-compatible fields', () => {
    const chunk = golden.chat_completion_response_streaming_chunk;
    expect(chunk).toHaveProperty('id');
    expect(chunk).toHaveProperty('object', 'chat.completion.chunk');
    expect(chunk).toHaveProperty('choices');
  });

  it('error_response follows OpenAI error format', () => {
    const err = golden.error_response as { error: Record<string, unknown> };
    expect(err).toHaveProperty('error');
    expect(err.error).toHaveProperty('message');
    expect(err.error).toHaveProperty('type');
    expect(err.error).toHaveProperty('param');
    expect(err.error).toHaveProperty('code');
  });

  it('health_response has status, version, and uptime', () => {
    const health = golden.health_response;
    expect(health).toHaveProperty('status', 'ok');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('uptime');
  });

  it('request_trace has all telemetry fields', () => {
    const trace = golden.request_trace;
    expect(trace).toHaveProperty('id');
    expect(trace).toHaveProperty('timestamp');
    expect(trace).toHaveProperty('original_model');
    expect(trace).toHaveProperty('routed_model');
    expect(trace).toHaveProperty('task_tier');
    expect(trace).toHaveProperty('tokens');
    expect(trace).toHaveProperty('estimated_cost');
    expect(trace).toHaveProperty('latency_ms');
  });
});
