# GreenClaw — Testing Conventions

## Test Runner

Vitest is the test runner. Configuration lives in `vitest.config.ts`.

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Run in watch mode
```

## Test Organization

| Test File                          | Category | Purpose                                                              |
| ---------------------------------- | -------- | -------------------------------------------------------------------- |
| `tests/architecture.test.ts`       | Harness  | Enforces module layer dependency order                               |
| `tests/consistency.test.ts`        | Harness  | Validates AGENTS.md sync, module structure, naming, doc cross-links  |
|                                    |          | + CLAUDE.md module map matches src/, QUALITY.md has all modules      |
|                                    |          | + PLANS.md index matches exec-plans on disk, QUALITY.md grades valid |
| `tests/file-limits.test.ts`        | Harness  | Source files stay under 300 lines — prevents monoliths               |
| `tests/classifier.fixture.test.ts` | Fixture  | Classifier accuracy (>=90% on 50 samples)                            |
| `tests/golden.test.ts`             | Contract | API response shape validation                                        |

## Test Categories

### Harness Tests (always run)

Deterministic structural checks that catch drift between docs, code, and
architecture. These never depend on implementation — they validate the shape
of the codebase itself.

- Architecture layer enforcement
- Consistency checks (AGENTS.md, index.ts, naming guardrails)
- Doc cross-link validation (all links in AGENTS.md resolve to real files)
- Knowledge store structure (required docs exist)
- CLAUDE.md module map matches actual `src/` directories
- QUALITY.md has a row for every module, grades are valid (A/B/C/D)
- PLANS.md index matches plan files on disk
- File size limits (source files ≤300 lines)

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

## Adding Tests for a New Module

1. Create `tests/<module>.test.ts`
2. Add the module to `MODULES` in `tests/consistency.test.ts`
3. Add the module to `LAYER_ORDER` in `tests/architecture.test.ts`
4. Register the test in the table above
