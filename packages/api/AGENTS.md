# api/ — Agent Guidelines

## Ownership

Layer 4. Hono application serving the transparent proxy.

### What it owns

- `POST /v1/chat/completions` proxy endpoint — forwards OpenAI-compatible
  requests to the configured upstream base URL
- `GET /health` — health check endpoint
- Runtime entrypoint for local/dev and built startup
- Request orchestration: classify → compact → route → forward → respond
- Upstream request forwarding via `fetch` (streaming + non-streaming)
- Telemetry trace emission for non-health requests

### What it must NOT do

- Import from dashboard
- Contain classification, compaction, or routing logic inline
- Parse provider-specific request/response formats
- Rewrite successful upstream responses (forward status/body/headers as-is)

### Key invariants

- Every request follows the pipeline: classify → compact → route → forward
- Streaming SSE chunks are forwarded byte-for-byte, not parsed
- Every non-health request attempts to emit a `RequestTrace`
- Health endpoint returns 200 with `status`, `version`, `uptime`, and
  `traces_emitted`
- Only the `model` field may change in the forwarded request body
- `/health` is never traced
- Runtime startup binds the configured port and shuts down cleanly on signals
- App construction must stay testable via injected fetch, telemetry, logger,
  config, and clock dependencies

### Dependencies

- `@greenclaw/types` (Layer 0)
- `@greenclaw/config` (Layer 1)
- `@greenclaw/telemetry` (Layer 2)
- `@greenclaw/optimization` (Layer 3)
