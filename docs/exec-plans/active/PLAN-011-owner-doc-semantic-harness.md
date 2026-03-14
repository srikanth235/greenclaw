# PLAN-011 — Owner-Doc Semantic Harness

**Status**: Active — Week 1
**Goal**: Add one bounded LLM-backed semantic harness that checks whether package owner docs (`packages/<pkg>/AGENTS.md`) still match actual package behavior across every workspace package.

## Invariant Family

This plan targets one invariant family only:

**Owner-doc semantic consistency** — a package `AGENTS.md` must accurately
describe what the package owns, what it must not do, its key invariants, and
its dependency boundaries.

The harness must also fail when a present-tense owner-doc guarantee is only
aspirational in code/tests.

## Harness Design

### Test file

- `tests/owner-doc-semantic.test.ts`

### Scope

Run the harness for every workspace package:

- `packages/types`
- `packages/config`
- `packages/telemetry`
- `packages/optimization`
- `packages/monitoring`
- `packages/cli`
- `packages/api`
- `packages/dashboard`

The harness compares one package at a time with a fixed, bounded input set.

### Inputs per package

For each target package, provide:

1. `packages/<pkg>/AGENTS.md`
2. `packages/<pkg>/package.json`
3. All `packages/<pkg>/src/**/*.ts`
4. All `packages/<pkg>/tests/**/*.test.ts`
5. Shared repo context:
   - `ARCHITECTURE.md`
   - `docs/conventions/testing.md`
   - `docs/conventions/knowledge-store.md`

### Prompt contract

Require a strict JSON response:

```json
{
  "verdict": "PASS" | "FAIL",
  "summary": "one sentence",
  "findings": [
    {
      "category": "ownership" | "must_not" | "invariant" | "dependency",
      "doc_claim": "quoted or tightly paraphrased claim",
      "code_evidence": "specific file/path-based contradiction or missing implementation signal",
      "file": "packages/<pkg>/AGENTS.md",
      "confidence": 0.0
    }
  ]
}
```

The prompt must instruct the model to:

- use only the provided repository files
- ignore style and wording preferences
- fail on factual contradictions or present-tense guarantees that are not
  implemented
- cite concrete file evidence for every finding

### Execution model

- Local default: skip unless `GREENCLAW_ENABLE_LLM_HARNESS=1`
- Trusted CI: run when Codex auth is available
- If enabled but `codex` is unavailable or unauthenticated, fail loudly
- Use a fixed prompt, fixed file selection, and machine-validated JSON
- Use `gpt-5` with low reasoning effort by default

## Acceptance Criteria

1. The harness runs one semantic comparison per workspace package using a
   bounded repo-local file set.
2. The LLM response is validated against a schema before verdict handling.
3. Findings are package-scoped to the owner doc under review.
4. The harness fails on contradictions and aspirational-present-tense claims,
   not on style.
5. `docs/conventions/testing.md` documents the harness and activation model.

## Files Expected to Change

| File | Change |
| ---- | ------ |
| `tests/owner-doc-semantic.test.ts` | Add bounded LLM semantic harness |
| `tests/skip-hygiene.test.ts` | Register the intentional opt-in skip |
| `docs/conventions/testing.md` | Document the harness and trusted-CI model |
| `packages/*/AGENTS.md` | Tighten owner-doc wording where drift is found |
| `docs/QUALITY.md` | Track semantic owner-doc coverage |

## Known Risks

- LLM variance can create noisy failures if the prompt is not tightly bounded.
- Large file sets dilute signal; package inputs must stay package-local.
- Semantic findings should be promoted into deterministic tests when feasible.

## Out of Scope

- README semantic review
- Open-ended whole-repo review
- Automatic PR comments from the harness
