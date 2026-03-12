# PLAN-007: Monorepo Restructure + Usage Analytics & Budget Alerting

**Status**: Active — Week 1

**Goal**: Restructure into a pnpm workspace monorepo and add user-facing usage
analytics with budget alerting, exposed via a CLI package and OpenClaw skill.

## Acceptance Criteria

1. pnpm workspaces configured with 8 packages under `packages/`
2. Each package has its own `package.json`, `tsconfig.json`, `src/`, `AGENTS.md`
3. Existing telemetry code moved intact to `@greenclaw/telemetry`
4. `@greenclaw/monitoring` — UsageStore with aggregation queries + alert CRUD
5. `@greenclaw/cli` — `greenclaw` bin with usage/alerts/traces subcommands
6. `skill/greenclaw/SKILL.md` — OpenClaw skill wrapping the CLI
7. All CI passes: `pnpm typecheck && pnpm lint && pnpm test`

## Known Risks

- Monorepo migration: many file moves. Mitigated by most modules being stubs.
- Cross-package TypeScript resolution: workspace packages need proper config.
- SQL aggregation performance on large datasets: acceptable for local use.

## Out of Scope

- Materialized daily summaries, webhook alerts, DB rotation
- Dashboard integration, api/ middleware, multi-tenant tracking
- Turborepo or other build orchestration
