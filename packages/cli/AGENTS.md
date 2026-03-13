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
- Human-readable formatting is the GreenClaw skill's job, not the CLI's
- DB lifecycle: create store, use, close in finally block
- `alerts set` validates input against Zod schemas from `@greenclaw/types`
  before persisting — rejects invalid metric/unit/period/threshold values
- `alerts set` also enforces cross-field alert semantics: required `--model`
  for per-model rules, matching unit/period for each metric, and no stray model
  filter on non-model rules
- The `greenclaw` bin is exposed at the workspace root via root
  `package.json` `"bin"` field, so `npx greenclaw` works after install/build

### Dependencies

- `@greenclaw/types` (Layer 0)
- `@greenclaw/config` (Layer 1)
- `@greenclaw/telemetry` (Layer 2)
- `@greenclaw/monitoring` (Layer 3)
