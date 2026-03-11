# types/ — Agent Guidelines

## Ownership

This module defines all shared TypeScript types and Zod schemas for GreenClaw.

### What it owns

- OpenAI-compatible request/response Zod schemas (`ChatCompletionRequest`, `ChatCompletionResponse`)
- `TaskTier` enum: `HEARTBEAT | SIMPLE | MODERATE | COMPLEX`
- `RequestTrace` schema for telemetry
- `ProviderModel` type (provider name + model ID)
- `ChatMessage` schema (role + content + optional tool_calls)

### What it must NOT do

- Import from any other `src/` module — types is the bottom layer
- Contain any runtime logic, side effects, or I/O
- Declare TypeScript types independently of Zod schemas

### Key invariants

- Every exported type must be derived from a Zod schema via `z.infer<>`
- All schemas must be exported so other modules can use `.parse()` / `.safeParse()`
- All exports require JSDoc with `@param` and `@returns` where applicable

### Dependencies

None. This is the foundation layer.
