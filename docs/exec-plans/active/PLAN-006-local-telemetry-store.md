# PLAN-006: Local Telemetry Store

## Status

Active — Week 1

## Goal

Add a local observability stack using Pino (structured logger) and SQLite
(telemetry persistence) so that RequestTrace records are queryable by agents
and the dashboard module. No Docker. No external services.

## Acceptance Criteria

1. **Structured logging**
   - Pino replaces all future console-based logging
   - JSON output to stdout matches the format in observability.md
   - Log level configurable via `GREENCLAW_LOG_LEVEL` env var (default: info)

2. **Telemetry persistence**
   - `request_traces` table in SQLite stores all RequestTrace records
   - Schema matches the documented RequestTrace Zod schema
   - Indexes on: timestamp, task_tier, routed_model, latency_total_ms

3. **Agent query interface**
   - Exported query functions: byTimeRange, byTier, byModel, slowQueries
   - CLI script `scripts/query-traces.ts` for ad-hoc agent queries

4. **Graceful degradation**
   - If SQLite init fails, telemetry falls back to no-op mode
   - Proxy continues to function without persistence

5. **Build and CI**
   - `pnpm typecheck` passes with zero errors
   - `pnpm lint` passes with zero warnings
   - `pnpm test` runs and exits cleanly (updated harness tests pass)

## Files Expected to Change

| File                              | Change                                             |
| --------------------------------- | -------------------------------------------------- |
| `src/telemetry/AGENTS.md`         | New module ownership doc                           |
| `src/telemetry/index.ts`          | Public API entry point (re-exports)                |
| `src/telemetry/logger.ts`         | Pino logger factory                                |
| `src/telemetry/store.ts`          | SQLite store (insert, query, no-op fallback)       |
| `scripts/query-traces.ts`         | CLI query tool for agent consumption               |
| `tests/telemetry.test.ts`         | Unit tests for store and logger                    |
| `CLAUDE.md`                       | Renumber module map, add PLAN-006                  |
| `AGENTS.md`                       | Renumber module map, add PLAN-006                  |
| `ARCHITECTURE.md`                 | Renumber layer diagram, update system diagram      |
| `docs/QUALITY.md`                 | Add telemetry/ row                                 |
| `docs/PLANS.md`                   | Add PLAN-006 to Active Plans                       |
| `docs/conventions/observability.md` | SQLite schema, Pino details, graceful degradation |
| `docs/exec-plans/tech-debt-tracker.md` | TD-005/TD-006 → In Progress                  |
| `biome.json`                      | Layer enforcement overrides include telemetry      |
| `tests/architecture.test.ts`      | Add telemetry to LAYER_ORDER                       |
| `tests/consistency.test.ts`       | Add telemetry to MODULES                           |
| `tests/file-limits.test.ts`       | Add telemetry to MODULES                           |
| `tests/module-boundaries.test.ts` | Add telemetry to MODULES                           |

## Known Risks

- **better-sqlite3 requires native compilation** (node-gyp). Node 22 has stable
  native module support. Document prerequisites in CONTRIBUTING.md if needed.
- **DB file grows unbounded** without rotation. Add TD-007 for future pruning.
  Out of scope for this plan.

## Out of Scope

- DB rotation / pruning (future tech debt)
- Remote log shipping (Datadog, Loki, etc.)
- Dashboard integration (PLAN-005)
- OpenTelemetry integration
