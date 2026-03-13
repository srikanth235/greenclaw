# GreenClaw — Error Conventions

## Error Strategy

GreenClaw is a transparent proxy. Upstream provider errors are forwarded to
OpenClaw as-is — no wrapping or reformatting. GreenClaw only generates its own
error responses for proxy-level failures such as invalid requests or failed
upstream connections.

### GreenClaw Error Response Shape

For errors that originate within GreenClaw (not from upstream providers):

```json
{
  "error": {
    "message": "Human-readable description of the error",
    "type": "invalid_request_error",
    "param": "body",
    "code": null
  }
}
```

### Error Types

| Type                    | HTTP Status | When                                                             |
| ----------------------- | ----------- | ---------------------------------------------------------------- |
| `invalid_request_error` | 400         | Malformed request body, missing required fields                  |
| `api_connection_error`  | 502         | Could not connect to the configured upstream provider            |

### Upstream Errors

When an upstream provider returns an error response (4xx, 5xx), GreenClaw
forwards it unchanged. The raw upstream status and a sanitized summary are
recorded in the `RequestTrace`.

### Zod Schema (source of truth)

The response envelope lives in `packages/types/src/proxy.ts`:

```typescript
export const ErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable(),
    code: z.string().nullable(),
  }).passthrough(),
});
```

### Rules

1. **Never leak upstream details**: Error messages must not include upstream
   provider API keys, internal URLs, or raw upstream error bodies.
2. **Forward upstream errors**: When an upstream provider returns an error,
   forward the response to OpenClaw unchanged. Do not wrap or reformat it.
3. **Trace before responding when possible**: Every non-health request path
   attempts to emit a `RequestTrace` before the HTTP response is sent.
4. **Streaming errors**: For streaming requests, if the upstream connection
   fails mid-stream, close the stream gracefully.

### Error Handling by Layer

| Layer       | Responsibility                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| api/        | Validate request shape (→ `invalid_request_error`), surface failed upstream calls (→ `api_connection_error`), forward upstream errors unchanged |
| router/     | Return a provider/model pair from config for the resolved tier                                                                    |
| classifier/ | Must bias toward equal-or-higher complexity when signals are ambiguous                                                            |
| compactor/  | Never throws — returns input unchanged if compaction fails                                                                        |
