# GreenClaw — Observability Conventions

## Structured Logging

All GreenClaw log output is structured JSON written to stdout. No plain text
logging. This enables piping to any log aggregator (Datadog, Grafana Loki,
CloudWatch, etc.) without parsing.

### Log Format

```json
{
  "level": "info",
  "timestamp": "2026-03-11T00:00:00.000Z",
  "message": "Request proxied",
  "request_id": "req-abc123",
  "data": {}
}
```

### Log Levels

| Level   | Usage                                                           |
| ------- | --------------------------------------------------------------- |
| `error` | Unrecoverable failures, upstream errors returned to client      |
| `warn`  | Degraded state — retries exhausted, fallback triggered          |
| `info`  | Normal operations — request proxied, server started             |
| `debug` | Detailed diagnostics — classification signals, compaction stats |

`LOG_LEVEL` env var controls the minimum level emitted (default: `info`).

## RequestTrace Schema

Every proxied request emits exactly one `RequestTrace`. This is the
foundation of the cost dashboard and the primary observability signal.

```typescript
export const RequestTraceSchema = z.object({
  /** Unique trace identifier */
  id: z.string(),
  /** ISO 8601 timestamp */
  timestamp: z.string(),
  /** Correlation ID for the incoming request */
  request_id: z.string(),
  /** Model name from the incoming request */
  original_model: z.string(),
  /** Actual model used after routing */
  routed_model: z.string(),
  /** Provider that served the request */
  routed_provider: z.string(),
  /** Classified task tier */
  task_tier: TaskTierSchema,
  /** Whether context compaction was applied */
  compaction_applied: z.boolean(),
  /** Token counts */
  tokens: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
  }),
  /** Estimated cost comparison */
  estimated_cost: z.object({
    /** What this request would have cost at original model pricing */
    original_usd: z.number(),
    /** What this request actually cost after routing */
    routed_usd: z.number(),
    /** Savings: original - routed */
    savings_usd: z.number(),
  }),
  /** Latency breakdown in milliseconds */
  latency_ms: z.object({
    classify: z.number(),
    compact: z.number(),
    route: z.number(),
    upstream: z.number(),
    total: z.number(),
  }),
  /** Upstream HTTP status code (null if request never reached upstream) */
  upstream_status: z.number().nullable(),
  /** Error message if the request failed (null on success) */
  error: z.string().nullable(),
});
```

## Invariants

1. **Every request produces a trace** — success or failure. No silent drops.
2. **Traces are emitted before the response** — if the response write fails,
   the trace still exists.
3. **No PII in traces** — API keys, user content, and message bodies are
   never included. Only metadata.
4. **Trace IDs are unique** — use `crypto.randomUUID()`.
5. **Cost estimates are always present** — even if the estimate is approximate,
   never emit `null` for cost fields.

## Health Endpoint Telemetry

`GET /health` returns server status and is not traced (to avoid infinite
loops if a monitoring tool polls the health endpoint).

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 3600,
  "traces_emitted": 1234
}
```

## Dashboarding

The dashboard module reads `RequestTrace` records to compute:

- Total requests per tier (over time)
- Cost savings: `Σ savings_usd`
- Average latency per tier
- Error rate by provider
- Compaction frequency

These aggregations are computed on read, not maintained as counters, to
keep the proxy hot path free of dashboard overhead.
