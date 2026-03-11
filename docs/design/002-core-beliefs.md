# GreenClaw — Core Beliefs

Non-negotiable agent-first operating principles. These define how agents (and
humans) should think about GreenClaw development. Every code change should be
consistent with these beliefs.

## The Beliefs

### 1. Misclassify UP, never DOWN

A SIMPLE task routed to MODERATE wastes a few cents. A MODERATE task routed to
SIMPLE degrades quality. When the classifier is uncertain, it must always err
toward the more capable model.

### 2. Pure functions for the pipeline

Classifier, compactor, and router are pure functions — deterministic, no side
effects, no I/O. Same input always produces the same output. Side effects
(logging, persistence, network) happen only in the api/ orchestration layer.

### 3. Zod schemas are the single source of truth

Every external data shape is a Zod schema in `src/types/`. TypeScript types are
derived via `z.infer<>`. Never declare standalone `interface` or `type` for API
contracts. The schema IS the type.

### 4. Structured JSON logging only

All log output is structured JSON to stdout. No `console.log("something happened")`.
Every log entry has level, timestamp, message, request_id, and data fields.

### 5. Every request produces exactly one RequestTrace

No silent drops. Success or failure, every proxied request emits a trace before
the response is sent. If the response write fails, the trace still exists. This
is the foundation of cost observability.

### 6. Transparent proxy — never modify upstream responses

Requests are forwarded as-is after model swapping. Responses are forwarded
unchanged. Streaming SSE chunks pass through byte-for-byte. GreenClaw does not
parse, validate, or transform provider-specific formats.

### 7. Layer dependencies are enforced by tests, not just docs

`tests/architecture.test.ts` validates that no module imports from a higher
layer. If it's not in a test, it's not enforced. Documentation without
mechanical enforcement rots.

### 8. Config is immutable after startup

Configuration is loaded once at startup from environment variables and treated
as immutable. No runtime configuration changes. All tier-to-model mappings come
from config, never hardcoded in source.

### 9. Module AGENTS.md files stay under 80 lines

Each module has an `AGENTS.md` that defines ownership, boundaries, invariants,
and dependencies. These are concise ownership docs, not manuals. If a module's
AGENTS.md exceeds 80 lines, the rules are too complex or belong in docs/.
`tests/consistency.test.ts` enforces this.
