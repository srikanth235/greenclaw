/**
 * Shared proxy request and response schemas.
 * @module @greenclaw/types/proxy
 */

import { z } from 'zod';

/** Shared task tiers for classification and routing. */
export const TaskTierSchema = z.enum(['HEARTBEAT', 'SIMPLE', 'MODERATE', 'COMPLEX']);
/** Shared task tiers for classification and routing. */
export type TaskTier = z.infer<typeof TaskTierSchema>;

/** Routed provider/model pair selected by the router. */
export const ProviderModelSchema = z.object({
  provider: z.string(),
  model: z.string(),
});
/** Routed provider/model pair selected by the router. */
export type ProviderModel = z.infer<typeof ProviderModelSchema>;

/** Allowed OpenAI-compatible chat roles. */
export const ChatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
/** Allowed OpenAI-compatible chat roles. */
export type ChatRole = z.infer<typeof ChatRoleSchema>;

/** Tool-call payload shape carried on assistant messages. */
export const ToolCallSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    function: z
      .object({
        name: z.string().optional(),
        arguments: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();
/** Tool-call payload shape carried on assistant messages. */
export type ToolCall = z.infer<typeof ToolCallSchema>;

/** OpenAI-compatible chat message shape used for requests and responses. */
export const ChatMessageSchema = z
  .object({
    role: ChatRoleSchema,
    content: z.string().nullable(),
    name: z.string().optional(),
    tool_calls: z.array(ToolCallSchema).optional(),
    tool_call_id: z.string().optional(),
  })
  .passthrough();
/** OpenAI-compatible chat message shape used for requests and responses. */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** OpenAI-compatible chat completion request body. */
export const ChatCompletionRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(ChatMessageSchema),
  })
  .passthrough();
/** OpenAI-compatible chat completion request body. */
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

/** Token usage block on a non-streaming chat completion response. */
export const ChatCompletionUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});
/** Token usage block on a non-streaming chat completion response. */
export type ChatCompletionUsage = z.infer<typeof ChatCompletionUsageSchema>;

/** Single assistant choice returned from a chat completion response. */
export const ChatCompletionChoiceSchema = z
  .object({
    index: z.number(),
    message: ChatMessageSchema,
    finish_reason: z.string().nullable(),
  })
  .passthrough();
/** Single assistant choice returned from a chat completion response. */
export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>;

/** OpenAI-compatible non-streaming chat completion response. */
export const ChatCompletionResponseSchema = z
  .object({
    id: z.string(),
    object: z.literal('chat.completion'),
    created: z.number(),
    model: z.string(),
    choices: z.array(ChatCompletionChoiceSchema),
    usage: ChatCompletionUsageSchema,
  })
  .passthrough();
/** OpenAI-compatible non-streaming chat completion response. */
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

/** Delta payload emitted on a streaming chat completion chunk. */
export const ChatCompletionChunkDeltaSchema = z
  .object({
    role: z.literal('assistant').optional(),
    content: z.string().optional(),
  })
  .passthrough();
/** Delta payload emitted on a streaming chat completion chunk. */
export type ChatCompletionChunkDelta = z.infer<typeof ChatCompletionChunkDeltaSchema>;

/** Single choice inside a streaming chat completion chunk. */
export const ChatCompletionChunkChoiceSchema = z
  .object({
    index: z.number(),
    delta: ChatCompletionChunkDeltaSchema,
    finish_reason: z.string().nullable(),
  })
  .passthrough();
/** Single choice inside a streaming chat completion chunk. */
export type ChatCompletionChunkChoice = z.infer<typeof ChatCompletionChunkChoiceSchema>;

/** OpenAI-compatible streaming chat completion chunk. */
export const ChatCompletionChunkSchema = z
  .object({
    id: z.string(),
    object: z.literal('chat.completion.chunk'),
    created: z.number(),
    model: z.string(),
    choices: z.array(ChatCompletionChunkChoiceSchema),
  })
  .passthrough();
/** OpenAI-compatible streaming chat completion chunk. */
export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunkSchema>;

/** GreenClaw health response shape. */
export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    version: z.string(),
    uptime: z.number(),
    traces_emitted: z.number().optional(),
  })
  .passthrough();
/** GreenClaw health response shape. */
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Provider-style error payload forwarded by GreenClaw. */
export const ErrorBodySchema = z
  .object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable(),
    code: z.string().nullable(),
  })
  .passthrough();
/** Provider-style error payload forwarded by GreenClaw. */
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/** Top-level error response envelope. */
export const ErrorResponseSchema = z
  .object({
    error: ErrorBodySchema,
  })
  .passthrough();
/** Top-level error response envelope. */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
