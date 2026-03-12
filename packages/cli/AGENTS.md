# cli/ — Agent Guidelines

## Ownership

Layer 4. CLI entry point for usage analytics, alerting, and trace queries.

### What it owns

- `greenclaw` bin entry point
- Usage subcommands (summary, breakdown, trends)
- Alert subcommands (list, set, remove, history, check)
- Trace subcommands (migrated from scripts/query-traces.ts)

### What it must NOT do

- Import from api or dashboard
- Contain business logic (delegate to monitoring and telemetry)
- Output anything other than JSON to stdout
- Read env vars directly (use `@greenclaw/config`)

### Key invariants

- All output is JSON to stdout for agent/skill consumption
- Human-readable formatting is the OpenClaw skill's job, not the CLI's
- DB lifecycle: create store, use, close in finally block
- `alerts set` validates input against Zod schemas from `@greenclaw/types`
  before persisting — rejects invalid metric/unit/period/threshold values
- The `greenclaw` bin is exposed at the workspace root via root
  `package.json` `"bin"` field, so `pnpm exec greenclaw` works

### Dependencies

- `@greenclaw/types` (Layer 0)
- `@greenclaw/config` (Layer 1)
- `@greenclaw/telemetry` (Layer 2)
- `@greenclaw/monitoring` (Layer 3)
