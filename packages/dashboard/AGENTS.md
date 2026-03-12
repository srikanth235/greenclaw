# dashboard/ — Agent Guidelines

## Ownership

Layer 5. Read-only cost telemetry dashboard.

### What it owns

- Lightweight Hono routes for serving aggregated telemetry data
- Telemetry aggregation queries (cost per tier, savings over time)

### What it must NOT do

- Mutate telemetry data — strictly read-only
- Expose write endpoints or admin actions
- Block or slow down the main proxy hot path

### Key invariants

- Dashboard is non-critical — proxy functions without it
- All data is derived from `RequestTrace` and usage analytics
- No authentication required in v1 (local use only)
- Built last — stub only during initial development phases

### Dependencies

- `@greenclaw/types` (Layer 0)
- `@greenclaw/monitoring` (Layer 3)
- `@greenclaw/telemetry` (Layer 2)
