# GreenClaw — Error Conventions

## Error Strategy

GreenClaw is a transparent proxy. Upstream provider errors are forwarded to
OpenClaw as-is — no wrapping or reformatting. GreenClaw only generates its own
error responses for proxy-level failures (authentication, internal errors, etc.).

### GreenClaw Error Response Shape

For errors that originate within GreenClaw (not from upstream providers):

```json
{
  "error": {
    "message": "Human-readable description of the error",
    "type": "authentication_error",
    "code": null
  }
}
```

### Error Types

| Type                    | HTTP Status | When                                                             |
| ----------------------- | ----------- | ---------------------------------------------------------------- |
| `invalid_request_error` | 400         | Malformed request body, missing required fields                  |
| `authentication_error`  | 401         | Missing or invalid `GREENCLAW_API_KEY`                           |
| `not_found_error`       | 404         | Unknown endpoint                                                 |
| `server_error`          | 500         | Internal GreenClaw failure (classification, compaction, routing) |
| `upstream_unreachable`  | 502         | Could not connect to upstream provider                           |
| `timeout_error`         | 504         | Upstream provider timed out                                      |

### Upstream Errors

When an upstream provider returns an error response (4xx, 5xx), GreenClaw
forwards it to OpenClaw unchanged. OpenClaw already knows how to handle
provider-specific error formats. The raw upstream status and a sanitized
summary are recorded in the `RequestTrace`.

### Zod Schema (source of truth)

The error schema lives in `src/types/index.ts`:

```typescript
export const GreenClawErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.enum([
      'invalid_request_error',
      'authentication_error',
      'not_found_error',
      'server_error',
      'upstream_unreachable',
      'timeout_error',
    ]),
    code: z.string().nullable(),
  }),
});

export type GreenClawError = z.infer<typeof GreenClawErrorSchema>;
```

### Rules

1. **Never leak upstream details**: Error messages must not include upstream
   provider API keys, internal URLs, or raw upstream error bodies.
2. **Forward upstream errors**: When an upstream provider returns an error,
   forward the response to OpenClaw unchanged. Do not wrap or reformat it.
3. **Log before responding**: Every error must emit a `RequestTrace` with
   error details to the telemetry store before the HTTP response is sent.
4. **Streaming errors**: For streaming requests, if the upstream connection
   fails mid-stream, close the stream gracefully.

### Error Handling by Layer

| Layer       | Responsibility                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| api/        | Authenticate requests (→ `authentication_error`), catch internal exceptions (→ `server_error`), forward upstream errors unchanged |
| router/     | Return `server_error` if no model is configured for the resolved tier                                                             |
| classifier/ | Never throws — returns `COMPLEX` as safe fallback on unexpected input                                                             |
| compactor/  | Never throws — returns input unchanged if compaction fails                                                                        |
