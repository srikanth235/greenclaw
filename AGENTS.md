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
   - Behaviour change → update the package's `packages/<pkg>/AGENTS.md`
   - Quality change → update `docs/QUALITY.md`
   - New convention → add to `docs/conventions/`
3. **Implement** — Only now write application code, tests, and config.
4. **Cross-link** — Ensure the relevant index doc (e.g. `docs/PLANS.md`,
   `docs/design/index.md`) is updated with any new artifacts.
5. **Verify** — `pnpm typecheck && pnpm lint && pnpm test`

### What counts as a knowledge store update

| Change type    | Required knowledge store update                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| New feature    | Execution plan + module AGENTS.md                                                  |
| Bug fix        | Update QUALITY.md (defect log) + add test description to testing.md if new pattern |
| Refactor       | ADR if architectural, else update affected AGENTS.md                               |
| New package    | AGENTS.md + QUALITY.md row + CLAUDE.md package map row + architecture test entry   |
| Config / infra | Update relevant convention doc                                                     |

### Why this ordering matters

- Un-documented intent is invisible to future agent sessions.
- Docs-first forces clear thinking about scope before code is generated.
- Prevents knowledge drift: docs and code ship together.

### Enforcement

- Never start a code edit without a corresponding knowledge store
  update already staged or written in the same session.
- If the change is a single-line fix, the minimum update is a comment
  in the relevant AGENTS.md or QUALITY.md noting the fix.
- CI consistency tests (`tests/consistency.test.ts`) validate that
  modules, docs, and cross-links stay in sync.

## Knowledge Invariants

- **Discoverability** — durable docs are linked, indexed, and reachable.
- **Ownership** — code surfaces change with their owner docs.
- **Executable parity** — commands, env vars, and runtime claims match code.
- **Status locality** — volatile progress/status lives only in status docs.
- **Terminology** — product and domain language stays canonical.
- **Cross-doc consistency** — repeated claims must agree semantically.

Deep policy, claim classes, and LLM semantic-check guidance live in
[docs/conventions/knowledge-store.md](docs/conventions/knowledge-store.md).

## Start Here

| Document                                       | What you'll find                                            |
| ---------------------------------------------- | ----------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | System diagram, dependency layers, request lifecycle        |
| [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | Problem, solution, target users, what GreenClaw is NOT      |
| [docs/QUALITY.md](docs/QUALITY.md)             | Quality grade per module — implementation, tests, docs gaps |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Change lifecycle, adding code, commit workflow, JSDoc       |

## Package Map

| Layer | Package                  | Owner doc                                    |
| ----- | ------------------------ | -------------------------------------------- |
| 5     | `packages/dashboard/`    | [AGENTS.md](packages/dashboard/AGENTS.md)    |
| 4     | `packages/api/`          | [AGENTS.md](packages/api/AGENTS.md)          |
| 4     | `packages/cli/`          | [AGENTS.md](packages/cli/AGENTS.md)          |
| 3     | `packages/optimization/` | [AGENTS.md](packages/optimization/AGENTS.md) |
| 3     | `packages/monitoring/`   | [AGENTS.md](packages/monitoring/AGENTS.md)   |
| 2     | `packages/telemetry/`    | [AGENTS.md](packages/telemetry/AGENTS.md)    |
| 1     | `packages/config/`       | [AGENTS.md](packages/config/AGENTS.md)       |
| 0     | `packages/types/`        | [AGENTS.md](packages/types/AGENTS.md)        |

**Dependency rule**: import only from **same or lower** layer.
Enforced by `tests/architecture.test.ts`.

## Design

[Full index](docs/design/index.md)

## Conventions

| Document                                              | Scope                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| [errors.md](docs/conventions/errors.md)               | Error shape, upstream passthrough, error types by HTTP status |
| [knowledge-store.md](docs/conventions/knowledge-store.md) | Knowledge-doc invariants, claim classes, semantic guard rails |
| [observability.md](docs/conventions/observability.md) | Structured logging, RequestTrace schema, health endpoint      |
| [testing.md](docs/conventions/testing.md)             | Test categories, harness tests, adding new tests              |
| [security.md](docs/conventions/security.md)           | API key handling, PII rules, error sanitization               |
| [commits.md](docs/conventions/commits.md)             | Conventional Commits format, type table, scope rules          |
| [doc-governance.md](docs/conventions/doc-governance.md) | Document mutation classes, append-only ledgers, owner-map rules |

## Execution Plans

[All plans](docs/PLANS.md) · [Tech debt](docs/exec-plans/tech-debt-tracker.md)

## References

| Document                                                         | Topic                                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [harness-engineering.md](docs/references/harness-engineering.md) | Harness engineering principles — knowledge store first, agent legibility, enforcing invariants |
