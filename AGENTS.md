# GreenClaw — Agent Guidelines

> **Name guardrail**: This product is **GreenClaw**.
> Never use "ClawProxy", "InferenceProxy", or any alternative name. CI enforces this.

This file is a **map, not a manual**. The knowledge base lives in `docs/`.
Read the relevant doc before making changes in that area.

## Knowledge Store First (Mandatory)

> Inspired by harness engineering: the repository's knowledge base is the
> **system of record**. If it isn't in `docs/`, it doesn't exist.

**For every change request — no exceptions — update the knowledge store
before writing or modifying application code.**

### Workflow

1. **Read** — Read the relevant `AGENTS.md`, design doc, or convention doc
   for the area you are about to change.
2. **Document** — Write or update the knowledge store artifact _first_:
   - New feature → execution plan in `docs/exec-plans/active/`
   - Non-obvious decision → ADR in `docs/design/`
   - Behaviour change → update the module's `src/<mod>/AGENTS.md`
   - Quality change → update `docs/QUALITY.md`
   - New convention → add to `docs/conventions/`
3. **Implement** — Only now write application code, tests, and config.
4. **Cross-link** — Ensure CLAUDE.md, AGENTS.md tables, and doc indexes
   stay in sync with any new artifacts.
5. **Verify** — `pnpm typecheck && pnpm lint && pnpm test`

### What counts as a knowledge store update

| Change type    | Required knowledge store update                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| New feature    | Execution plan + module AGENTS.md                                                  |
| Bug fix        | Update QUALITY.md (defect log) + add test description to testing.md if new pattern |
| Refactor       | ADR if architectural, else update affected AGENTS.md                               |
| New module     | AGENTS.md + QUALITY.md row + CLAUDE.md module map row + architecture test entry    |
| Config / infra | Update relevant convention doc                                                     |

### Why this ordering matters

- Agents operate on repository-local context. Un-documented intent is
  invisible to future sessions.
- Writing the doc first forces clear thinking about scope, affected
  modules, and edge cases — before code is generated.
- It prevents knowledge drift: the docs and code ship together, but
  the docs are written first so they drive the implementation, not
  the other way around.

### Enforcement

- Never start a code edit without a corresponding knowledge store
  update already staged or written in the same session.
- If the change is a single-line fix, the minimum update is a comment
  in the relevant AGENTS.md or QUALITY.md noting the fix.
- CI consistency tests (`tests/consistency.test.ts`) validate that
  modules, docs, and cross-links stay in sync.

## Start Here

| Document                                       | What you'll find                                            |
| ---------------------------------------------- | ----------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | System diagram, dependency layers, request lifecycle        |
| [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | Problem, solution, target users, what GreenClaw is NOT      |
| [docs/QUALITY.md](docs/QUALITY.md)             | Quality grade per module — implementation, tests, docs gaps |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Change lifecycle, adding code, commit workflow, JSDoc       |

## Module Map

| Layer | Module            | Owner doc                             |
| ----- | ----------------- | ------------------------------------- |
| 6     | `src/dashboard/`  | [AGENTS.md](src/dashboard/AGENTS.md)  |
| 5     | `src/api/`        | [AGENTS.md](src/api/AGENTS.md)        |
| 4     | `src/router/`     | [AGENTS.md](src/router/AGENTS.md)     |
| 3     | `src/compactor/`  | [AGENTS.md](src/compactor/AGENTS.md)  |
| 2     | `src/classifier/` | [AGENTS.md](src/classifier/AGENTS.md) |
| 1     | `src/config/`     | [AGENTS.md](src/config/AGENTS.md)     |
| 0     | `src/types/`      | [AGENTS.md](src/types/AGENTS.md)      |

**Dependency rule**: import only from **same or lower** layer.
Enforced by `tests/architecture.test.ts`.

## Design

[Full index](docs/design/index.md)

| Document                                         | Topic                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| [001](docs/design/001-philosophy.md)             | Transparent proxy, heuristics-first, pure pipeline, cost optimization |
| [002](docs/design/002-core-beliefs.md)           | Agent-first operating principles (9 beliefs)                          |
| [003](docs/design/003-language-and-framework.md) | TypeScript + Hono + Node 22 + pnpm                                    |
| [004](docs/design/004-routing-strategy.md)       | Four-tier routing (HEARTBEAT → SIMPLE → MODERATE → COMPLEX)           |
| [005](docs/design/005-zod-as-source-of-truth.md) | Zod schemas as single source of truth                                 |

## Conventions

| Document                                              | Scope                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| [errors.md](docs/conventions/errors.md)               | Error shape, upstream passthrough, error types by HTTP status |
| [observability.md](docs/conventions/observability.md) | Structured logging, RequestTrace schema, health endpoint      |
| [testing.md](docs/conventions/testing.md)             | Test categories, harness tests, adding new tests              |
| [security.md](docs/conventions/security.md)           | API key handling, PII rules, error sanitization               |
| [commits.md](docs/conventions/commits.md)             | Conventional Commits format, type table, scope rules          |

## Execution Plans

[All plans](docs/PLANS.md) · [Tech debt](docs/exec-plans/tech-debt-tracker.md)

| Plan                                                          | Status | Goal                                               |
| ------------------------------------------------------------- | ------ | -------------------------------------------------- |
| [PLAN-001](docs/exec-plans/active/PLAN-001-proxy-skeleton.md) | Active | Transparent passthrough proxy with instrumentation |

## References

| Document                                                         | Topic                                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [harness-engineering.md](docs/references/harness-engineering.md) | Harness engineering principles — knowledge store first, agent legibility, enforcing invariants |
