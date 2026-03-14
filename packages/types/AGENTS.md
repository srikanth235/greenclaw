---
package: types
layer: 0
tier: standard
grade: B
autonomy:
  bootable: true
  contract: false
  observable: false
  rollback_safe: true
---
# types/ — Agent Guidelines

## Ownership

Layer 0. Shared Zod schemas and derived TypeScript types for all packages.

### What it owns

- Alert analytics schemas (`AlertRuleSchema`, `AlertEventSchema`, etc.)
- OpenAI-compatible chat request/response schemas
- Shared task-tier and provider-model schemas
- Health and error response envelopes
- RequestTrace and telemetry value-object schemas

### What it must NOT do

- Import from any other `@greenclaw/*` package — types is the foundation layer
- Contain any runtime logic, side effects, or I/O
- Declare TypeScript types independently of Zod schemas

### Key invariants

- Every exported type must be derived from a Zod schema via `z.infer<>`
- All schemas must be exported for `.parse()` / `.safeParse()` use
- Package boundaries consume these schemas instead of redefining them locally
- All exports require JSDoc

### Dependencies

- No internal `@greenclaw/*` package dependencies
- External runtime dependency: `zod`
