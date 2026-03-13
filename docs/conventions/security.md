# GreenClaw — Security Conventions

## Runtime Secret Surface

GreenClaw currently documents only upstream-provider credentials as runtime
secrets:

- `UPSTREAM_OPENAI_API_KEY`
- `UPSTREAM_ANTHROPIC_API_KEY`
- `UPSTREAM_OPENROUTER_API_KEY`

These variables are part of the operational secret surface even when a local
development setup uses a mock upstream instead of real provider auth.

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

See [observability.md](observability.md) for the full RequestTrace
schema and invariants.

## Error Sanitization

GreenClaw-generated errors use a controlled shape (see [errors.md](errors.md)):

```json
{
  "error": {
    "message": "Human-readable, safe description",
    "type": "server_error",
    "code": null
  }
}
```

Upstream provider errors are forwarded unchanged. GreenClaw-generated errors
must stay free of credential values or internal topology details.

## Environment Variable Management

- All secrets live in `.env` (git-ignored) with placeholders in `.env.example`
- `.env.example` contains placeholder values, never real keys
- Non-config secret env vars must be documented here if they appear in
  `.env.example`

## Streaming Security

For streaming (SSE) requests:

- Chunks are forwarded byte-for-byte — no parsing or inspection
- If the upstream connection fails mid-stream, close the stream gracefully
- Never buffer the full stream in memory (forward as received)
