# PLAN-011 — Owner-Doc Semantic Harness

**Status**: Active — Week 1
**Goal**: Add one bounded LLM-backed semantic harness that checks whether package owner docs (`packages/<pkg>/AGENTS.md`) still match actual package behavior.

## Invariant Family

This plan targets one invariant family only:

**Owner-doc semantic consistency** — a package `AGENTS.md` must accurately
describe what the package owns, what it must not do, its key invariants, and
its dependency boundaries.

This is a semantic invariant because structural checks can prove that the doc
exists and is linked, but cannot prove that the doc still tells the truth.

## Harness Design

### Test file

Add a new root harness:

- `tests/owner-doc-semantic.test.ts`

### Scope

Start with the three highest-value packages:

- `packages/api`
- `packages/config`
- `packages/telemetry`

Do not scan the whole repo in v1. The harness should compare one package at a
time with a fixed, bounded input set.

### Inputs per package

For each target package, the harness provides the LLM with:

1. `packages/<pkg>/AGENTS.md`
2. `packages/<pkg>/package.json`
3. `packages/<pkg>/src/index.ts`
4. All first-level `packages/<pkg>/src/*.ts` files
5. Relevant package-local tests under `packages/<pkg>/tests/`
6. One shared root doc for context:
   - `ARCHITECTURE.md`
   - `docs/conventions/testing.md`

Do not include unrelated packages or the whole `docs/` tree.

### Prompt contract

The harness must use a fixed prompt and require a fixed JSON response shape:

```json
{
  "verdict": "PASS" | "FAIL",
  "summary": "one sentence",
  "findings": [
    {
      "category": "ownership" | "must_not" | "invariant" | "dependency",
      "doc_claim": "quoted or tightly paraphrased claim",
      "code_evidence": "specific file/path-based contradiction",
      "file": "packages/<pkg>/AGENTS.md",
      "confidence": 0.0
    }
  ]
}
```

The prompt must instruct the model to:

- use only the provided repository files
- ignore stylistic issues
- fail only on factual contradictions or material omissions
- cite concrete file evidence for every finding
- return `PASS` when the owner doc is semantically consistent even if wording
  differs from the code

### Execution model

Use the existing `codex exec` integration pattern already present in the repo.

- Local default: skip unless `GREENCLAW_ENABLE_LLM_HARNESS=1`
- CI behavior: run in a dedicated job with `GREENCLAW_ENABLE_LLM_HARNESS=1`
- If enabled but `codex` is unavailable, fail loudly
- If disabled, the test should skip with a clear reason

This keeps the default suite fast and deterministic while still making the LLM
harness part of the repository test surface.

## Acceptance Criteria

1. The harness runs one semantic comparison per target package (`api`,
   `config`, `telemetry`) using a bounded repo-local file set
2. The LLM response is machine-validated as JSON before verdict handling
3. The test fails only on factual owner-doc contradictions, not wording/style
4. Every failure includes the contradicted claim and concrete file evidence
5. The harness is opt-in locally and runnable in CI via an explicit env flag
6. `docs/conventions/testing.md` documents the harness and its enablement model

## Files Expected to Change

| File | Change |
| ---- | ------ |
| `tests/owner-doc-semantic.test.ts` | Add bounded LLM-backed semantic harness |
| `docs/conventions/testing.md` | Document the new harness, enablement flag, and failure contract |
| `docs/conventions/knowledge-store.md` | Add this harness as the first concrete LLM semantic example |
| `docs/QUALITY.md` | Track the new harness once implemented |
| `packages/api/AGENTS.md` | Tighten wording if the first semantic pass exposes drift |
| `packages/config/AGENTS.md` | Tighten wording if the first semantic pass exposes drift |
| `packages/telemetry/AGENTS.md` | Tighten wording if the first semantic pass exposes drift |

## Known Risks

- LLM variance can create noisy failures if the prompt is not tightly bounded
- Large file sets can dilute signal; v1 must stay limited to three packages
- If findings recur, the relevant rule should be promoted into a deterministic
  harness instead of leaving it permanently LLM-only

## Out of Scope

- Full-repo semantic review
- README or convention-doc semantic review
- Automated PR comments or inline code annotations
- Replacing deterministic parity tests with LLM checks
