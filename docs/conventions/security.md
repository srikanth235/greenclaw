# GreenClaw — Security Conventions

## API Key Authentication

GreenClaw requires a `GREENCLAW_API_KEY` environment variable. Incoming requests
must include this key for authentication. Missing or invalid keys return a
`401 authentication_error` response.

## Upstream Provider Keys

Upstream API keys (OpenAI, Anthropic, etc.) are stored as environment variables
and used by the proxy to authenticate with upstream providers.

### Rules

1. **Never log API keys** — not in structured logs, not in error messages, not
   in RequestTrace records.
2. **Never include API keys in error responses** — if an upstream provider
   returns an auth error, forward the response as-is but never echo GreenClaw's
   own upstream credentials.
3. **Never expose internal URLs** — upstream provider endpoints are internal
   configuration. Error messages must not reveal them.

## PII and Data Handling

RequestTrace records are the primary observability signal. They must **never**
contain personally identifiable information:

- No message content (user prompts, assistant responses)
- No API keys or auth tokens
- No user identifiers beyond the request correlation ID
- Only metadata: model names, token counts, cost estimates, latency, tier

See [observability.md](conventions/observability.md) for the full RequestTrace
schema and invariants.

## Error Sanitization

GreenClaw-generated errors use a controlled shape (see [errors.md](conventions/errors.md)):

```json
{
  "error": {
    "message": "Human-readable, safe description",
    "type": "server_error",
    "code": null
  }
}
```

Upstream provider errors are forwarded unchanged — GreenClaw does not parse,
wrap, or inspect them. This avoids accidentally leaking information through
error transformation.

## Environment Variable Management

- All secrets live in `.env` (git-ignored) with defaults in `.env.example`
- `.env.example` contains placeholder values, never real keys
- Config module validates all required env vars at startup and fails fast
  with clear error messages if any are missing

## Streaming Security

For streaming (SSE) requests:

- Chunks are forwarded byte-for-byte — no parsing or inspection
- If the upstream connection fails mid-stream, close the stream gracefully
- Never buffer the full stream in memory (forward as received)
