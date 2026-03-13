# GreenClaw — Testing Conventions

## Test Runner

Vitest is the test runner. Configuration lives in `vitest.config.ts`.

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Run in watch mode
```

## Test Organization

| Test File                          | Category | Purpose                                                             |
| ---------------------------------- | -------- | ------------------------------------------------------------------- |
| `tests/architecture.test.ts`       | Harness  | Layer deps, pure-function layers, circular deps, deep import guard  |
| `tests/consistency.test.ts`        | Harness  | Structural discovery (AGENTS.md, naming, module map, doc backlinks, |
|                                    |          | plan lifecycle) + semantic doc-contracts (README, env, status docs) |
| `tests/file-limits.test.ts`        | Harness  | Source files ≤300 lines, test-file-per-module                       |
| `tests/module-boundaries.test.ts`  | Harness  | No hardcoded models, no PII in logs, Zod source-of-truth            |
| `tests/skip-hygiene.test.ts`       | Harness  | No unmanaged `it.skip`/`describe.skip` without allowlisted reason   |
| `tests/suppression-hygiene.test.ts`| Harness  | No unmanaged source suppressions without linked PLAN/TD reference   |
| `tests/knowledge-gate.test.ts`     | Harness  | Relevance gate: path-specific doc requirements for code changes     |
| `tests/jsdoc-hygiene.test.ts`      | Harness  | Exported declarations and callable docs require JSDoc/tag coverage   |
| `tests/proxy-contracts.test.ts`    | Contract | Upstream passthrough, only-model-mutates, boot smoke test           |
| `tests/classifier.fixture.test.ts` | Fixture  | Classifier accuracy (>=90% on 50 samples)                           |
| `tests/golden.test.ts`             | Contract | API response shape validation                                       |
| `packages/*/tests/**/*.test.ts`    | Unit     | Package-local behavior and CLI/business-rule regression coverage    |

## Test Categories

### Harness Tests (always run)

Deterministic structural checks that catch drift between docs, code, and
architecture. These never depend on implementation — they validate the shape
of the codebase itself.

- Architecture layer enforcement (no upward imports)
- Pure function layers (classifier, compactor, router have no I/O imports)
- Circular dependency detection across all modules
- Re-export hygiene (no deep imports across module boundaries)
- Consistency checks (AGENTS.md, index.ts, naming guardrails)
- Doc cross-link validation (all links resolve to real files)
- Skill docs that invoke local CLI tools keep runnable command syntax
- Doc backlinks (no orphan docs in design/, conventions/, exec-plans/)
- AGENTS.md structure validation (required sections)
- Convention coverage (every convention listed in CLAUDE.md)
- Design doc freshness (valid statuses in design index)
- Knowledge store structure (required docs exist)
- CLAUDE.md module map matches actual `packages/` directories
- QUALITY.md has a row for every module, grades are valid (A/B/C/D)
- PLANS.md index matches plan files on disk
- Exec-plan lifecycle (active/completed status matches directory)
- File size limits (source files ≤300 lines)
- Test file per module (every module has a test file)
- No hardcoded model names outside config/
- No PII/secrets in log calls
- Zod source-of-truth enforcement in types/
- No `process.env` outside config/ (Biome `noProcessEnv`)
- Pure-module side-effect ban (timers, Math.random, Date.now in pure layers)
- No unmanaged `it.skip`/`describe.skip` without allowlisted reason
- No unmanaged `TODO`/`FIXME`/ignore directives without linked PLAN/TD
- Relevance gate (packages/ changes require owner docs and package-specific companion docs)
- AST-based JSDoc hygiene (`@param` / `@returns` on exported callables)
- Telemetry logger JSON contract validation
- Telemetry SQLite schema/index parity against observability docs
- Trace-shape hygiene for stored telemetry fields

#### Semantic doc-contract checks (in consistency.test.ts)

These validate that documentation claims match executable truth:

- README script parity: every `pnpm <script>` in README exists in package.json
- README runtime parity: Quick Start/startup claims map to a real runtime entrypoint
- README tooling parity: lint/format tool names match actual devDependencies
- Env var parity: `.env.example` vars match `env.*` / `process.env.*` reads in config/
- Security-secret exceptions: non-config env vars in `.env.example` must be documented in security.md
- Status-doc boundaries: volatile prose only in QUALITY.md, PLANS.md, active plans, and debt tracker

### Fixture / Eval Tests (skipped until implemented)

Tests that evaluate the quality of a module's output against a labeled dataset.
These use `it.skip` until the module has real logic (not stubs).

- Classifier accuracy fixture: >=90% on `tests/fixtures/requests.json`

### Contract Tests (skipped until implemented)

Tests that validate proxy behavior invariants against mock upstreams.

- Upstream passthrough parity (non-streaming success, error forwarding)
- Only-model-mutates (GreenClaw changes only the `model` field)
- Boot smoke test (`/health` returns documented shape on ephemeral port)

### Unit Tests

Module-specific tests for business logic. Each module may have its own test file.
Package-local unit tests may live under `packages/*/tests/` when that keeps
workspace package behavior isolated from unrelated root harnesses.

## Conventions

1. **No test pollution**: Tests must not modify project files or leave artifacts
2. **Deterministic**: Same result on every run
3. **Fast**: Individual tests complete in <100ms (except fixture evals)
4. **Isolated**: No dependency on execution order
5. **Descriptive failures**: Use expect's second argument for context messages
6. **Line-scoped static checks**: For regex-based source scans, evaluate
   exclusions (like comment handling) per line, not per file, to avoid
   false negatives.
7. **Blocking by default**: New feasible harnesses should fail in CI as soon
   as they land. Use `it.skip` only when the target capability does not yet
   exist, and register every skip in `tests/skip-hygiene.test.ts`.
8. **Suppressions require an owner**: Source-level TODOs and ignore directives
   must carry a `PLAN-xxx` or `TD-xxx` reference on the same line so they can
   be retired deliberately.

## Harness Activation Policy

- Unskip architecture, golden, contract, and fixture tests as soon as the
  underlying package has a real implementation seam to exercise.
- Prefer deterministic mock upstreams and injected dependencies over
  environment-coupled integration tests.
- When a formerly skipped harness is activated, remove the corresponding
  allowlist entry and update `docs/QUALITY.md` in the same change.

## Adding Tests for a New Module

1. Create `tests/<module>.test.ts`
2. Add the module to `MODULES` in `tests/consistency.test.ts`
3. Add the module to `LAYER_ORDER` in `tests/architecture.test.ts`
4. Add the module to `MODULES` in `tests/file-limits.test.ts`
5. Add the module to `MODULES` in `tests/module-boundaries.test.ts`
6. Register the test in the table above
