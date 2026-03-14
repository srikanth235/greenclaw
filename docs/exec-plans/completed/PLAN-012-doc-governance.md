# PLAN-012: Document Governance Harness

**Status**: Completed — 2026-03-14

## Goal

Enforce mutation policies on knowledge-store documents so that ledgers are
append-only, grades require rationale, owner-maps stay concise, and reference
docs cite their enforcers.

## Acceptance Criteria

1. **Convention doc** — `docs/conventions/doc-governance.md` defines six
   mutation classes (ledger, state, decision, index, owner-map, reference)
   with per-class rules.
2. **Harness test** — `tests/doc-governance.test.ts` uses git-diff to enforce
   mutation rules on changed docs:
   - Ledger: defect-log entries and resolved-debt rows are append-only
   - State: QUALITY.md grade changes require a Notes-column change
   - Owner-map: no volatile status language in AGENTS.md / CLAUDE.md
   - Reference: imperative rules in convention docs cite an enforcer (warning)
3. **Cross-links** — CLAUDE.md, AGENTS.md, knowledge-store.md, QUALITY.md
   updated to reference the new convention and harness.

## Files Expected to Change

| File / Area | Change |
| --- | --- |
| `docs/conventions/doc-governance.md` | New — mutation class taxonomy |
| `tests/doc-governance.test.ts` | New — git-diff-based harness |
| `docs/conventions/knowledge-store.md` | Cross-link to doc-governance |
| `docs/QUALITY.md` | Add harness row |
| `CLAUDE.md` | Add conventions table row |
| `AGENTS.md` | Add conventions table row |
| `docs/PLANS.md` | Add PLAN-012 row |

## Known Risks

- Decision-doc immutability deferred: no accepted/completed docs exist yet to
  test against. Will be added when the first ADR reaches Accepted status.

## Out of Scope

- Full state-machine enforcement for plan lifecycle transitions
- Generated/parity-checked reference tables (future PLAN)
