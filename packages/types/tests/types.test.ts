import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ChatCompletionChunkSchema,
  ChatCompletionResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  RequestTraceSchema,
  TaskTierSchema,
} from '../src/index.js';

const GOLDEN_PATH = path.resolve(__dirname, '../../../tests/fixtures/golden-responses.json');

describe('types', () => {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8')) as Record<string, unknown>;

  it('exports the expected task tiers', () => {
    expect(TaskTierSchema.options).toEqual(['HEARTBEAT', 'SIMPLE', 'MODERATE', 'COMPLEX']);
  });

  it('parses the golden response fixtures', () => {
    expect(ChatCompletionResponseSchema.safeParse(golden.chat_completion_response).success).toBe(
      true,
    );
    expect(
      ChatCompletionChunkSchema.safeParse(golden.chat_completion_response_streaming_chunk).success,
    ).toBe(true);
    expect(HealthResponseSchema.safeParse(golden.health_response).success).toBe(true);
    expect(ErrorResponseSchema.safeParse(golden.error_response).success).toBe(true);
    expect(RequestTraceSchema.safeParse(golden.request_trace).success).toBe(true);
  });
});
