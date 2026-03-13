# types/ — Agent Guidelines

## Ownership

Layer 0. Shared Zod schemas and derived TypeScript types for all packages.

### What it owns

- Alert analytics schemas (`AlertRuleSchema`, `AlertEventSchema`, etc.)
- OpenAI-compatible request/response schemas and error envelopes
- Shared routing primitives (`TaskTier`, `ProviderModel`)
- Health response schema
- Telemetry schemas (`RequestTrace`, tokens, cost, latency)

### What it must NOT do

- Import from any other `@greenclaw/*` package — types is the foundation layer
- Contain any runtime logic, side effects, or I/O
- Declare TypeScript types independently of Zod schemas

### Key invariants

- Every exported type must be derived from a Zod schema via `z.infer<>`
- All schemas must be exported for `.parse()` / `.safeParse()` use
- All exports require JSDoc

### Dependencies

None. This is the foundation layer.
