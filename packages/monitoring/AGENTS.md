# monitoring/ — Agent Guidelines

## Ownership

Layer 3. Usage analytics and budget alerting for end users.

### What it owns

- `UsageStore` — aggregation queries over request_traces
- Alert rule CRUD (create, list, remove)
- Alert evaluation engine (checkAlerts)
- Alert event history
- Usage summary, breakdown, and trend queries

### What it must NOT do

- Import from optimization, cli, api, or dashboard
- Own the request_traces table (owned by telemetry)
- Close the shared DB handle (lifecycle owned by telemetry)
- Send notifications (alerts are CLI-queryable only)

### Key invariants

- All aggregations are on-demand SQL, no materialized views
- Alert events deduplicated by (rule_id, period_start)
- Graceful degradation: returns empty results if DB handle is null
- All timestamps are UTC ISO-8601

### Dependencies

- `@greenclaw/types` (Layer 0) — alert schemas
- `@greenclaw/config` (Layer 1) — DB path
- `@greenclaw/telemetry` (Layer 2) — getDb() for shared DB access
