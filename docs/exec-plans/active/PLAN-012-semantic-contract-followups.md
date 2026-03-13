# PLAN-012 — Semantic Claim Enforcement and Contract Follow-Ups

**Status**: Active — Week 1
**Goal**: Tighten the post-PLAN-010 and post-PLAN-011 guard rails so semantic repo-truth checks distinguish descriptive truth from normative guarantees and promote stable claim families into stronger deterministic enforcement.

## Scope

This follow-up plan covers the next layer of repo-truth hardening:

- claim classification guidance for descriptive, normative, and aspirational statements
- deterministic parity checks for README/runtime/env/tooling drift that remain outside the owner-doc harness
- semantic harness hardening around schema validation, exact package scoping, and bounded inputs
- policy linkage between semantic drift and `docs/QUALITY.md` grades
- documentation cleanup so plan history stays append-only instead of repurposing older plans

This plan builds on PLAN-010 and PLAN-011 rather than rewriting them.

## Acceptance Criteria

1. `PLAN-010` remains scoped to its merged repo-truth guard work and is not repurposed to describe this follow-up.
2. A new plan records the follow-up claim-enforcement work and is linked from root plan indexes.
3. `docs/conventions/knowledge-store.md` and `docs/conventions/testing.md` clearly distinguish:
   - descriptive claims checked semantically against code
   - normative guarantees that should be promoted into deterministic tests
   - aspirational work that belongs in plans or design docs rather than package invariants
4. `tests/owner-doc-semantic.test.ts` validates model output against a schema and scopes findings to the exact package owner doc under review.
5. `tests/consistency.test.ts` and `tests/knowledge-gate.test.ts` enforce the deterministic parity and relevance rules added in this follow-up.

## Files Expected to Change

| File | Change |
| ---- | ------ |
| `docs/exec-plans/active/PLAN-012-semantic-contract-followups.md` | Record the follow-up scope and acceptance criteria |
| `AGENTS.md` | Add PLAN-012 to the execution-plan index |
| `docs/PLANS.md` | Add PLAN-012 to the active-plan index |
| `docs/conventions/knowledge-store.md` | Document claim classes and enforcement ladder |
| `docs/conventions/testing.md` | Document deterministic-first promotion rules |
| `tests/owner-doc-semantic.test.ts` | Harden schema validation and exact package scoping |
| `tests/consistency.test.ts` | Add deterministic parity checks for repo-truth drift |
| `tests/knowledge-gate.test.ts` | Tighten path-to-doc relevance requirements |
| `docs/QUALITY.md` | Link grade guidance to semantic and deterministic coverage |

## Known Risks

- Claim taxonomy can become hand-wavy if docs continue mixing present truth, guarantees, and future intent in one section.
- Deterministic parity checks can drift into presentation policing if they are not tied to executable behavior.
- LLM-backed semantic checks still depend on external auth and quota, so CI ownership must stay explicit.

## Out of Scope

- Replacing deterministic behavioral tests with LLM review
- Automatic mutation of `docs/QUALITY.md` grades based on harness results
- Open-ended whole-repo semantic auditing outside bounded package or contract scopes
