# types/ — Agent Guidelines

## Ownership

Layer 0. Shared Zod schemas and derived TypeScript types for all packages.

### What it owns

- Alert analytics schemas (`AlertRuleSchema`, `AlertEventSchema`, etc.)
- OpenAI-compatible request/response Zod schemas (planned)
- `TaskTier` enum: `HEARTBEAT | SIMPLE | MODERATE | COMPLEX` (planned)
- `RequestTrace` schema for telemetry (planned)
- `ProviderModel` type (planned)

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
