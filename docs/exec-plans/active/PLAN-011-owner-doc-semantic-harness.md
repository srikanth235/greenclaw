# PLAN-011 — Owner-Doc Semantic Harness and Claim Enforcement

**Status**: Active — Week 1
**Goal**: Add one bounded LLM-backed semantic harness for package owner docs and use its first findings to tighten claim classification, deterministic parity, and repo-truth enforcement around those docs.

## Invariant Family

This plan primarily targets one invariant family:

**Owner-doc semantic consistency** — a package `AGENTS.md` must accurately
describe what the package owns, what it must not do, its key invariants, and
its dependency boundaries.

The harness must also fail when a present-tense owner-doc guarantee is only
aspirational in code/tests.

The first follow-up work from this harness also clarifies how the repository
classifies claims:

- descriptive claims should be checked semantically against current code
- normative guarantees should be promoted into deterministic tests when stable
- aspirational or future work belongs in plans/design docs, not package
  invariants

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

## Follow-Up Scope

This plan also captures the first round of repo-truth follow-up work that
landed immediately after the initial harness:

- harden schema validation and exact package scoping in
  `tests/owner-doc-semantic.test.ts`
- tighten deterministic parity checks for README/runtime/env/tooling drift in
  `tests/consistency.test.ts`
- tighten path-to-doc relevance in `tests/knowledge-gate.test.ts`
- document claim classes and deterministic-first promotion rules in
  `docs/conventions/knowledge-store.md` and
  `docs/conventions/testing.md`
- link semantic drift expectations to package grades in `docs/QUALITY.md`

`PLAN-010` remains the merged record for the broader repo-truth guard work that
preceded this harness-specific follow-up.

## Acceptance Criteria

1. The harness runs one semantic comparison per workspace package using a
   bounded repo-local file set.
2. The LLM response is validated against a schema before verdict handling.
3. Findings are package-scoped to the owner doc under review.
4. The harness fails on contradictions and aspirational-present-tense claims,
   not on style.
5. `docs/conventions/knowledge-store.md` and
   `docs/conventions/testing.md` distinguish descriptive claims, normative
   guarantees, and aspirational work.
6. `tests/consistency.test.ts` and `tests/knowledge-gate.test.ts` enforce the
   deterministic parity and relevance rules added in this follow-up.
7. `docs/QUALITY.md` documents how semantic drift affects package-grade
   expectations.

## Files Expected to Change

| File | Change |
| ---- | ------ |
| `tests/owner-doc-semantic.test.ts` | Add bounded LLM semantic harness |
| `tests/skip-hygiene.test.ts` | Register the intentional opt-in skip |
| `docs/conventions/testing.md` | Document the harness, trusted-CI model, and deterministic-first promotion rules |
| `docs/conventions/knowledge-store.md` | Document claim classes and the enforcement ladder |
| `packages/*/AGENTS.md` | Tighten owner-doc wording where drift is found |
| `tests/consistency.test.ts` | Add deterministic parity checks for repo-truth drift |
| `tests/knowledge-gate.test.ts` | Tighten path-to-doc relevance requirements |
| `docs/QUALITY.md` | Track semantic owner-doc coverage and grade expectations |

## Known Risks

- LLM variance can create noisy failures if the prompt is not tightly bounded.
- Large file sets dilute signal; package inputs must stay package-local.
- Semantic findings should be promoted into deterministic tests when feasible.
- Claim taxonomy can become vague if docs mix present truth, guarantees, and
  future intent in the same section.

## Out of Scope

- README semantic review
- Open-ended whole-repo review
- Automatic PR comments from the harness
- Automatic mutation of `docs/QUALITY.md` grades based on harness results
