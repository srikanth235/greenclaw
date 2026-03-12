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
| `tests/consistency.test.ts`        | Harness  | AGENTS.md sync, naming, module map, QUALITY, PLANS, doc backlinks,  |
|                                    |          | AGENTS.md structure, convention coverage, plan lifecycle, freshness |
| `tests/file-limits.test.ts`        | Harness  | Source files ≤300 lines, test-file-per-module                       |
| `tests/module-boundaries.test.ts`  | Harness  | No hardcoded models, no PII in logs, Zod source-of-truth            |
| `tests/classifier.fixture.test.ts` | Fixture  | Classifier accuracy (>=90% on 50 samples)                           |
| `tests/golden.test.ts`             | Contract | API response shape validation                                       |

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
- Doc backlinks (no orphan docs in design/, conventions/, exec-plans/)
- AGENTS.md structure validation (required sections + consistent headings)
- Convention coverage (every convention listed in CLAUDE.md)
- Design doc freshness (valid statuses in design index)
- Knowledge store structure (required docs exist)
- CLAUDE.md module map matches actual `src/` directories
- QUALITY.md has a row for every module, grades are valid (A/B/C/D)
- PLANS.md index matches plan files on disk
- Exec-plan lifecycle (active/completed status matches directory)
- File size limits (source files ≤300 lines)
- Test file per module (every module has a test file)
- No hardcoded model names outside config/
- No PII/secrets in log calls
- Zod source-of-truth enforcement in types/

### Fixture / Eval Tests (skipped until implemented)

Tests that evaluate the quality of a module's output against a labeled dataset.
These use `it.skip` until the module has real logic (not stubs).

- Classifier accuracy fixture: >=90% on `tests/fixtures/requests.json`

### Unit Tests

Module-specific tests for business logic. Each module may have its own test file.

## Conventions

1. **No test pollution**: Tests must not modify project files or leave artifacts
2. **Deterministic**: Same result on every run
3. **Fast**: Individual tests complete in <100ms (except fixture evals)
4. **Isolated**: No dependency on execution order
5. **Descriptive failures**: Use expect's second argument for context messages
6. **Line-scoped static checks**: For regex-based source scans, evaluate
   exclusions (like comment handling) per line, not per file, to avoid
   false negatives.

## Adding Tests for a New Module

1. Create `tests/<module>.test.ts`
2. Add the module to `MODULES` in `tests/consistency.test.ts`
3. Add the module to `LAYER_ORDER` in `tests/architecture.test.ts`
4. Add the module to `MODULES` in `tests/file-limits.test.ts`
5. Add the module to `MODULES` in `tests/module-boundaries.test.ts`
6. Register the test in the table above
