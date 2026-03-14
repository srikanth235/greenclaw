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
| `tests/consistency.test.ts`        | Harness  | Structural discovery + deterministic repo-truth parity checks       |
| `tests/file-limits.test.ts`        | Harness  | Source files ≤300 lines, test-file-per-module                       |
| `tests/module-boundaries.test.ts`  | Harness  | No hardcoded models, no PII in logs, Zod source-of-truth            |
| `tests/skip-hygiene.test.ts`       | Harness  | No unmanaged `it.skip`/`describe.skip` without allowlisted reason   |
| `tests/suppression-hygiene.test.ts`| Harness  | No unmanaged source suppressions without linked PLAN/TD reference   |
| `tests/knowledge-gate.test.ts`     | Harness  | Relevance gate: path-specific code/config changes require docs      |
| `tests/jsdoc-hygiene.test.ts`      | Harness  | Exported declarations and callable docs require JSDoc/tag coverage   |
| `tests/owner-doc-semantic.test.ts` | Harness  | Opt-in semantic check: `packages/*/AGENTS.md` vs package behavior   |
| `tests/proxy-contracts.test.ts`    | Contract | Upstream passthrough, only-model-mutates, boot smoke test           |
| `tests/classifier.fixture.test.ts` | Fixture  | Classifier accuracy (>=90% on 50 samples)                           |
| `tests/golden.test.ts`             | Contract | API response shape validation                                       |
| `packages/*/tests/**/*.test.ts`    | Unit     | Package-local behavior and CLI/business-rule regression coverage    |

## Test Categories

### Harness Tests (always run)

Deterministic structural checks (in `tests/*.test.ts`) that catch drift
between docs, code, and architecture. These never depend on implementation —
they validate the shape of the codebase itself.

- Architecture layer enforcement (no upward imports)
- Pure function layers (classifier, compactor, router have no I/O imports)
- Circular dependency detection across all modules
- Re-export hygiene (no deep imports across module boundaries)
- Consistency checks (AGENTS.md, index.ts, naming guardrails)
- Doc cross-link validation (all links resolve to real files)
- Skill docs that invoke local CLI tools keep runnable command syntax
- Doc backlinks (no orphan docs in design/, conventions/, exec-plans/)
- AGENTS.md structure validation (required sections + consistent headings; `tests/consistency.test.ts`)
- Convention coverage (every convention listed in CLAUDE.md)
- Design doc freshness (valid statuses in design index)
- Knowledge store structure (required docs exist; `tests/consistency.test.ts`)
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
- Relevance gate (owner docs and package-specific companion docs)
- AST-based JSDoc hygiene (`@param` / `@returns` on exported callables)
- Telemetry logger JSON contract validation
- Telemetry SQLite schema/index parity against observability docs
- Trace-shape hygiene for stored telemetry fields
- Autonomy readiness table coverage (every package has a row)
- Autonomy tier validation (critical-tier packages maintain grade >= B)
- Frontmatter schema validation (every AGENTS.md has valid YAML frontmatter)
- Frontmatter-table parity (QUALITY.md, CLAUDE.md, doc-governance.md match frontmatter)

#### Deterministic repo-truth parity checks (in `tests/consistency.test.ts`)

These validate that documentation claims match executable truth:

- README script parity: every `pnpm <script>` in README exists in root `package.json`
- README runtime parity: Quick Start/startup claims map to a real runtime entrypoint
- README tooling parity: lint/format tool names match installed tooling
- Env var parity: `.env.example` matches `env.*` / `process.env.*` reads in `config/`
- Security env parity: non-config env vars in `.env.example` are documented in `security.md`
- Quality-grade policy: package A-grades require semantic PASS notes

#### Claim classification

GreenClaw uses three claim classes:

- descriptive current-state claims: semantic checks are acceptable
- normative behavioral guarantees: prefer deterministic executable tests
- deferred or aspirational claims: keep them in plans/ADRs, not package invariants

If a semantic harness repeatedly finds the same drift, replace it with a normal
deterministic harness.

#### LLM semantic harnesses

When deterministic checks cannot express a repo-truth invariant cleanly, a
bounded LLM harness is acceptable. Follow
[knowledge-store.md](knowledge-store.md):

- deterministic parity first; semantic harnesses cover the residual gap
- compare a named set of repo files, not the whole codebase
- require `PASS` / `FAIL` plus concrete file evidence
- use the same prompt and response schema every run
- treat present-tense unimplemented guarantees as failures

The first implemented semantic harness is
[PLAN-011](../exec-plans/completed/PLAN-011-owner-doc-semantic-harness.md):
owner-doc semantic consistency for every workspace package. It is disabled by
default and runs only when `GREENCLAW_ENABLE_LLM_HARNESS=1`.

Trusted CI may run this harness when Codex auth is configured. Test-only
activation flags belong in testing docs and CI config, not in `.env.example`.

### Unit Tests

Module-specific tests for business logic. Each module may have its own test file.
Package-local unit tests may live under `packages/*/tests/` when that keeps
workspace package behavior isolated from unrelated root harnesses.

## Conventions

1. **No test pollution**: Tests must not modify project files or leave artifacts (manual review)
2. **Deterministic**: Same result on every run
3. **Fast**: Individual tests complete in <100ms (except fixture evals)
4. **Isolated**: No dependency on execution order
5. **Descriptive failures**: Use expect's second argument for context messages
6. **Line-scoped static checks**: For regex-based source scans, evaluate
   exclusions (like comment handling) per line, not per file, to avoid
   false negatives.
7. **Blocking by default**: New feasible harnesses should fail in CI as soon
   as they land. Use `it.skip` only when the target capability does not yet
   exist or when a semantic harness is intentionally opt-in, and register every
   skip in `tests/skip-hygiene.test.ts`.
8. **Suppressions require an owner**: Source-level TODOs and ignore directives
   must carry a `PLAN-xxx` or `TD-xxx` reference on the same line so they can
   be retired deliberately. Enforced by `tests/suppression-hygiene.test.ts`.

## Harness Activation Policy

- Unskip architecture, golden, contract, and fixture tests as soon as the
  underlying package has a real implementation seam to exercise.
- Prefer deterministic mock upstreams and injected dependencies over
  environment-coupled integration tests.
- When a formerly skipped harness is activated, remove the corresponding
  allowlist entry and update `docs/QUALITY.md` in the same change.
- When a semantic harness becomes trusted-CI eligible, wire its activation into
  CI and update `docs/QUALITY.md` in the same change.

## Shared Test Utilities

`tests/lib/frontmatter.ts` provides the canonical package list and metadata.
All test files import from here instead of maintaining local `PACKAGES`
constants. Enforced by `tests/consistency.test.ts`.

- `loadAllPackageMeta()` — reads all `packages/*/AGENTS.md` frontmatter
- `getPackageNames()` — sorted by layer
- `getPackageOrder()` — layer-ordered for architecture checks
- `getPackagesByTier(tier)` — filtered by tier

## Adding Tests for a New Module

1. Create `tests/<module>.test.ts`
2. Add YAML frontmatter to `packages/<module>/AGENTS.md`
3. Register the test in the table above
