# PLAN-009: Harness Expansion and Contract Activation

**Status**: Completed — 2026-03-13

## Goal

Expand GreenClaw's harness coverage so repository truth, telemetry contracts,
shared schemas, optimization behavior, and proxy passthrough guarantees are
mechanically enforced. The result should be fewer skipped tests, stronger
blocking CI guarantees, and fewer documented-but-unproven invariants.

## Acceptance Criteria

1. **Docs-first harness expansion**
   - `docs/PLANS.md` and root `AGENTS.md` index PLAN-009
   - `docs/conventions/testing.md` documents every new harness and the blocking
     policy for skips and suppressions
   - `docs/QUALITY.md` includes explicit rows for suppression hygiene and
     telemetry contracts
   - `packages/api/AGENTS.md`, `packages/telemetry/AGENTS.md`, and
     `packages/optimization/AGENTS.md` document the new enforced invariants

2. **Repo-wide blocking harnesses**
   - `tests/knowledge-gate.test.ts` treats `packages/*/src/**` as
     implementation changes
   - `tests/architecture.test.ts` no longer skips the layer-dependency check
   - `tests/suppression-hygiene.test.ts` fails on unmanaged
     `TODO`/`FIXME`/`XXX`, ignore directives, and type-suppression comments
   - Consistency checks fail if required harness rows are missing from
     `docs/QUALITY.md`

3. **Telemetry and schema contracts**
   - Telemetry logger output is tested through `createLogger()` itself
   - SQLite schema and indexes are verified against
     `docs/conventions/observability.md`
   - `@greenclaw/types` exports TaskTier, RequestTrace, health, error, chat
     completion, and streaming chunk schemas
   - Golden-file tests validate against real Zod schemas with no remaining
     schema-related skips

4. **Proxy and optimization contract activation**
   - `@greenclaw/api` exposes a testable Hono app factory and server bootstrap
   - Proxy contract tests run live for passthrough, only-model-mutates,
     `/health`, and SSE byte-for-byte forwarding
   - The classifier fixture test runs live and stays at or above 90% accuracy
   - Remaining skips, if any, are narrowly scoped and tied to an active plan

5. **Verification**
   - `pnpm typecheck` passes
   - `pnpm lint` passes
   - `pnpm test` passes

## Files Expected to Change

| File / Area                          | Change |
| ------------------------------------ | ------ |
| `docs/PLANS.md`, `AGENTS.md`         | Index PLAN-009 |
| `docs/conventions/testing.md`        | Add harness descriptions and blocking policy |
| `docs/QUALITY.md`                    | Track new harness domains and completed activation work |
| `packages/types/`, `packages/api/`   | Shared schemas, proxy app factory, boot helpers |
| `packages/telemetry/`                | Shared RequestTrace usage, logger/schema contract tests |
| `packages/optimization/`             | Classifier/router implementation and invariant tests |
| `tests/`                             | Knowledge gate, suppression hygiene, golden activation, proxy contracts |

## Known Risks

- **Fixture overfitting**: classifier heuristics must satisfy the current
  labeled dataset without becoming brittle or opaque.
- **Streaming tests**: SSE passthrough checks must assert byte parity without
  introducing flaky timing assumptions.
- **Schema drift**: docs, Zod schemas, and SQLite rows must stay aligned; if
  any one changes independently, multiple harnesses will fail.

## Out of Scope

- Recurring doc-gardening automation outside the repository CI harness
- Dashboard UI implementation beyond testable schema compatibility
- New provider-specific request/response transformations
