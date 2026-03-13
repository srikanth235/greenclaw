# PLAN-010 — Semantic Repo-Truth and Claim Enforcement

**Status**: Active — Week 1
**Goal**: Upgrade the knowledge-store guard rails so they enforce path-to-doc relevance, executable parity, and claim classification instead of only structural doc presence.

## Scope

This plan defines the broad enforcement shape for repo truth:

- knowledge-store invariant families and claim classes
- path-specific knowledge gate rules instead of "any docs changed"
- deterministic parity checks for README/runtime/env/tooling drift
- quality-policy linkage for semantic harness coverage
- trusted CI wiring for bounded semantic harnesses

The concrete owner-doc semantic harness lands under PLAN-011.

## Acceptance Criteria

1. `docs/conventions/knowledge-store.md` defines invariant families, claim
   classes, and the deterministic-first enforcement ladder.
2. The knowledge gate requires package-specific owner docs and companion docs
   for relevant code/config changes.
3. Deterministic parity checks cover README scripts/runtime/tooling and env var
   drift against config/security docs.
4. `docs/QUALITY.md` documents how semantic drift affects package grades.
5. CI fetches enough history for merge-base diffing and includes a trusted
   semantic-harness lane when Codex auth is configured.

## Files Expected to Change

| File | Change |
| ---- | ------ |
| `docs/conventions/knowledge-store.md` | Add invariant families and claim taxonomy |
| `docs/conventions/testing.md` | Document deterministic parity and semantic harness policy |
| `tests/knowledge-gate.test.ts` | Replace broad gate with path-specific relevance rules |
| `tests/consistency.test.ts` | Add deterministic repo-truth parity checks |
| `.github/workflows/ci.yml` | Fetch merge-base history and add trusted semantic lane |
| `docs/QUALITY.md` | Link grades to semantic and deterministic claim coverage |

## Known Risks

- Over-broad gate rules create busywork instead of useful review pressure.
- Semantic CI requires explicit Codex auth and should not silently appear
  mandatory on untrusted forks.
- Deterministic parity checks can become brittle if they are phrased around
  presentation instead of executable truth.

## Out of Scope

- Open-ended whole-repo semantic review
- Automatic grade rewriting inside CI
- New runtime features unrelated to repo-truth enforcement
