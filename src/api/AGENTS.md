# api/ — Agent Guidelines

## Ownership

This module is the Hono application that serves the transparent proxy.

### What it owns

- Catch-all proxy endpoint — forwards requests to upstream providers
- `GET /health` — health check endpoint
- Request orchestration: classify → compact → route → forward → respond
- Upstream request forwarding via `fetch` (streaming + non-streaming)
- Telemetry trace persistence

### What it must NOT do

- Import from dashboard
- Contain classification, compaction, or routing logic inline
- Parse or validate provider-specific request/response formats
- Modify upstream responses (forward them as-is)

### Key invariants

- Every request follows the pipeline: classify → compact → route → forward
- Requests and responses are forwarded transparently — no format conversion
- Streaming SSE chunks are forwarded byte-for-byte, not parsed
- Every request produces a `RequestTrace` written to the telemetry store
- Health endpoint returns 200 with uptime and version

### Dependencies from types/

- `RequestTrace` — telemetry schema

### Dependencies from other modules

- classifier/ — `classify()`
- compactor/ — `compact()`
- router/ — `route()`
- config/ — runtime configuration
