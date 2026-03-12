# api/ — Agent Guidelines

## Ownership

Layer 4. Hono application serving the transparent proxy.

### What it owns

- Catch-all proxy endpoint — forwards requests to upstream providers
- `GET /health` — health check endpoint
- Request orchestration: classify → compact → route → forward → respond
- Upstream request forwarding via `fetch` (streaming + non-streaming)
- Telemetry trace emission and alert evaluation

### What it must NOT do

- Import from dashboard
- Contain classification, compaction, or routing logic inline
- Parse provider-specific request/response formats
- Modify upstream responses (forward as-is)

### Key invariants

- Every request follows the pipeline: classify → compact → route → forward
- Streaming SSE chunks are forwarded byte-for-byte, not parsed
- Every request produces a `RequestTrace` written to the telemetry store
- Health endpoint returns 200 with uptime and version

### Dependencies

- `@greenclaw/types` (Layer 0)
- `@greenclaw/config` (Layer 1)
- `@greenclaw/telemetry` (Layer 2)
- `@greenclaw/optimization` (Layer 3)
- `@greenclaw/monitoring` (Layer 3)
