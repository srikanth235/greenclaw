# GreenClaw — Knowledge-Store Invariants

The repository knowledge store is not just "docs that exist". It is a set of
claims that must remain discoverable, current, and mechanically defensible.
<!-- enforced by tests/consistency.test.ts and tests/doc-governance.test.ts -->

## Broad Invariant Families

| Invariant | Expectation | Preferred enforcement |
| --------- | ----------- | --------------------- |
| Discoverability | Durable knowledge artifacts are linked, indexed, and reachable from stable entry points | Deterministic tests |
| Ownership | Code surfaces change with their owner docs in the same change | Deterministic tests |
| Executable parity | Commands, env vars, runtime behavior, and operational claims match code/config | Deterministic parity tests first |
| Status locality | Volatile progress and rollout status live only in status docs (`QUALITY`, `PLANS`, active plans, debt tracker) | Deterministic tests |
| Terminology | Product names, package names, and domain terms stay canonical | Deterministic tests |
| Progressive disclosure | `AGENTS.md` files remain maps, not manuals | Lightweight deterministic checks + review |
| Decision provenance | Non-obvious behavior points back to a plan, ADR, or owner doc | Deterministic checks where possible |
| Cross-doc consistency | Repeated claims across docs do not contradict each other | Bounded semantic checks |
| Frontmatter parity | Machine-readable YAML frontmatter and human-readable markdown tables within the same file must agree | Deterministic intra-file parity tests (`tests/consistency.test.ts`, PLAN-014) |

## Claim Classes

Every durable repo claim should fall into exactly one class:

1. **Descriptive** — current-state truth about what the code does now.
   These are good candidates for semantic doc-vs-code checks.
2. **Normative** — current behavioral guarantees the code is expected to honor.
   These must have deterministic executable enforcement whenever feasible.
3. **Deferred** — future intent, rollout sequencing, or planned work.
   These belong in plans/ADRs, not as present-tense package invariants.

If a present-tense owner-doc invariant is not implemented yet, that is semantic
drift, not harmless aspiration.

## Enforcement Ladder

1. Prefer deterministic checks when the invariant can be expressed as exact
   parity, reachability, path-to-doc coupling, or an executable contract.
2. Promote repeated semantic findings into deterministic tests whenever the repo
   exposes a stable source of truth.
3. Use LLM-backed checks only for bounded repo-local comparisons that cannot be
   expressed reliably as exact parity.

## LLM Semantic Harness Rules

LLM integration is acceptable only when the question is semantic, repo-local,
and tightly bounded.

1. **Repo-local only** — inputs come from checked-in files or the PR diff.
2. **Bounded scope** — compare a named file set or claim family, not the whole repo.
3. **Strict verdict shape** — `PASS` / `FAIL` plus concrete file evidence.
4. **Fixed framing** — stable prompt, stable file selection, stable rubric.
5. **Escalation path** — recurring findings must be promoted into normal harnesses.

## Quality Linkage

`docs/QUALITY.md` is the status surface for semantic drift:

- package A-grades require deterministic coverage for normative guarantees
- package A-grades also require the latest owner-doc semantic verdict to be PASS
- repeated semantic failures must lower the documented grade or reopen the gap <!-- enforced by manual review -->

## Document Mutation Governance

Documents are classified by mutation type (ledger, state, decision, index,
owner-map, reference) with per-class enforcement rules. Full taxonomy and
harness details live in
[doc-governance.md](doc-governance.md).

## Non-Goals

Semantic checks are not for:

- style or tone feedback
- open-ended architecture review
- inventing new requirements not grounded in repository truth
- replacing deterministic checks that already express the invariant well
