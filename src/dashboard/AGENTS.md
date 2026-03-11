# dashboard/ — Agent Guidelines

## Ownership

This module serves the read-only cost telemetry dashboard.

### What it owns

- Lightweight Hono routes for serving aggregated telemetry data
- Static UI assets (if any)
- Telemetry aggregation queries (cost per tier, savings over time)

### What it must NOT do

- Import from any module other than types/ and config/
- Mutate telemetry data — this is strictly read-only
- Expose write endpoints or admin actions
- Block or slow down the main proxy hot path

### Key invariants

- Dashboard is non-critical — proxy functions without it
- All data is derived from `RequestTrace` records
- No authentication required in v1 (local use only)
- Built last — stub only during initial development phases

### Dependencies from types/

- `RequestTrace` — telemetry schema for aggregation

### Dependencies from config/

- Dashboard port and display settings
