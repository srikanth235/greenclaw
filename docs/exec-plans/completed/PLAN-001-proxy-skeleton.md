# PLAN-001: Passthrough Proxy Skeleton

**Status**: Completed — 2026-03-13

## Goal

Build a fully functional transparent passthrough proxy with instrumentation.
Zero optimization logic (no classification, compaction, or routing). Every
request is forwarded to the original upstream provider and the response is
returned unchanged. This validates the end-to-end pipeline before adding
intelligence.

## Acceptance Criteria

1. **Proxy passthrough**
   - All incoming requests are forwarded to the upstream provider as-is
   - Streaming responses are forwarded in real time (SSE passthrough)
   - Non-streaming responses are returned as the full upstream response
   - No provider-specific logic — requests and responses pass through
     unchanged regardless of format (OpenAI, Anthropic, etc.)

2. **Health endpoint**
   - `GET /health` returns HTTP 200 with JSON body:
     `{ "status": "ok", "version": "0.1.0", "uptime": <seconds> }`

3. **Telemetry**
   - Every request emits a `RequestTrace` to stdout as structured JSON
   - Trace includes: timestamp, request ID, model, token counts, latency,
     upstream provider, HTTP status

4. **Build and CI**
   - `pnpm typecheck` passes with zero errors
   - `pnpm lint` passes with zero warnings
   - `pnpm test` runs and exits cleanly
   - `pnpm build` produces `dist/` with valid JavaScript

5. **Integration**
   - Running `pnpm dev` starts the proxy on port 9090
   - A manual test with `curl` confirms end-to-end passthrough

## Files Expected to Change

| File                      | Change                                                        |
| ------------------------- | ------------------------------------------------------------- |
| `src/types/index.ts`      | Define Zod schemas for RequestTrace, TaskTier, GreenClawError |
| `src/config/index.ts`     | Load env vars, build Config object with Zod validation        |
| `src/api/index.ts`        | Hono app with catch-all proxy endpoint and GET /health        |
| `src/server.ts`           | Import api app, start Hono on configured port                 |
| `src/classifier/index.ts` | Stub: always returns COMPLEX (passthrough mode)               |
| `src/compactor/index.ts`  | Stub: returns messages unchanged                              |
| `src/router/index.ts`     | Stub: returns configured default provider model               |

## Known Risks

- **tiktoken WASM**: May have initialization overhead on first call. Mitigate by
  lazy-loading and caching the encoder instance.
- **Streaming passthrough**: Must forward SSE chunks byte-for-byte without
  parsing or modifying the stream content.

## Out of Scope

- Classification logic (PLAN-002)
- Context compaction (PLAN-003)
- Intelligent routing (PLAN-004)
- Dashboard UI (PLAN-005)
