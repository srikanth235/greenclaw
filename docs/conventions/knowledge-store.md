# GreenClaw — Knowledge-Store Invariants

The repository knowledge store is not just "docs that exist". It is a set of
claims that must remain discoverable, current, and mechanically defensible.

## Broad Invariant Families

| Invariant | Expectation | Preferred enforcement |
| --------- | ----------- | --------------------- |
| Discoverability | Every durable knowledge artifact is reachable from a stable entry point, linked correctly, and indexed where expected | Deterministic tests |
| Ownership | Every code surface has an owner doc, and implementation changes update that owner doc in the same change | Deterministic tests |
| Executable parity | Commands, env vars, runtime behavior, schemas, and operational claims in docs match code/config | Deterministic parity tests first |
| Status locality | Volatile implementation status lives only in status docs (`QUALITY`, `PLANS`, active plans, debt tracker) | Deterministic tests |
| Terminology | Product names, package names, and domain terms stay canonical across code and docs | Deterministic tests |
| Progressive disclosure | `AGENTS.md` files remain maps that point to deeper sources of truth rather than duplicating manuals | Lightweight deterministic checks + review |
| Decision provenance | Non-obvious behavior and architecture changes point back to an ADR, plan, or owner doc | Deterministic checks where possible |
| Cross-doc consistency | Repeated claims across multiple docs are semantically aligned and do not contradict each other | Bounded LLM semantic checks |

## Enforcement Ladder

1. Prefer deterministic checks when the invariant can be expressed as exact
   parity, reachability, or path-to-doc coupling.
2. Promote repeated semantic drift into deterministic parity tests whenever the
   repo exposes a stable executable source of truth.
3. Use LLM-backed checks only for bounded semantic comparisons that cannot be
   expressed reliably as exact string or schema parity.

## LLM Semantic Harness Rules

LLM integration is appropriate when the question is semantic, repo-local, and
bounded. Good examples:

- whether an owner doc still accurately describes package boundaries
- whether repeated claims across README/conventions/AGENTS conflict in meaning
- whether a user-facing explanation still matches runtime behavior even when no
  single deterministic signal fully captures the claim

These harnesses must follow strict rules:

1. **Repo-local only** — inputs come from the repository or PR diff, not the web
2. **Bounded scope** — compare a named set of files/claims, not the whole repo
3. **Verdict shape** — return `PASS` / `FAIL` plus concrete file references and
   the conflicting claim
4. **Deterministic framing** — fixed prompt, fixed file set, fixed evaluation
   rubric; no open-ended style review
5. **Escalation path** — if an LLM check finds a recurring pattern that can be
   expressed deterministically, replace it with a normal harness

## First Concrete Harness

The first planned LLM semantic harness is
[PLAN-011](../exec-plans/active/PLAN-011-owner-doc-semantic-harness.md):

- invariant family: owner-doc semantic consistency
- scope: `packages/api`, `packages/config`, `packages/telemetry`
- question: does `packages/<pkg>/AGENTS.md` still truthfully describe package
  ownership, prohibitions, invariants, and dependency boundaries?

## Non-Goals

LLM semantic checks are not for:

- taste-only writing feedback
- generic architecture review
- replacing deterministic checks that already express the invariant well
- inventing new requirements that are not grounded in repository truth
