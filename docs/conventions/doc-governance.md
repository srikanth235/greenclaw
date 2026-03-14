# GreenClaw — Document Governance

Every knowledge-store document belongs to a **mutation class**. The class
determines what kinds of changes are allowed and how the harness enforces them.

## Mutation Classes

| Class | Rule | Rationale |
| --- | --- | --- |
| **ledger** | Append-only. Existing entries must not be deleted or reworded. | Audit trail integrity; prevents revisionism |
| **state** | Valid transitions only. Changes require an accompanying rationale. | Prevents phantom quality claims |
| **decision** | Immutable after acceptance. Amend by creating a new ADR. | Decision history must be trustworthy |
| **index** | Bijective with files on disk. Entries must not silently disappear. | Discoverability invariant |
| **owner-map** | Concise, no volatile status. No dates, TODOs, WIP, changelogs. | "Map, not manual" — keeps agent context clean |
| **reference** | Imperative rules cite their enforcer (test, lint, or manual review). | Unenforced conventions are aspirational, not real |

## Document Classification

| Document | Class | Governed Section |
| --- | --- | --- |
| `docs/QUALITY.md` — Defect Log | ledger | `## Defect Log` to end-of-file |
| `docs/QUALITY.md` — Grade Tables | state | `## Package Quality` and `## Cross-Cutting Quality` |
| `docs/exec-plans/tech-debt-tracker.md` — Resolved | ledger | `## Resolved Debt` table |
| `docs/exec-plans/tech-debt-tracker.md` — Active | state | `## Active Debt` table (rows can move to Resolved) |
| `docs/design/*.md` | decision | Body after status line (when status is Accepted/Verified) |
| `docs/PLANS.md` | index | Plan link table |
| `docs/design/index.md` | index | Design doc table |
| `packages/*/AGENTS.md` | owner-map | Entire file |
| `CLAUDE.md` | owner-map | Entire file |
| `AGENTS.md` | owner-map | Entire file |
| `docs/conventions/*.md` | reference | Entire file |

## Enforcement

Enforced by `tests/doc-governance.test.ts`. Enforcement level per class:

| Class | Level | Detail |
| --- | --- | --- |
| ledger | **Hard fail** | Git-diff detects deleted or modified historical entries |
| state | **Hard fail** | Grade column change without Notes column change |
| decision | **Deferred** | No accepted ADRs exist yet; will activate when first ADR is accepted |
| index | **Existing** | Already covered by `tests/consistency.test.ts` (PLANS.md, design/index.md) |
| owner-map | **Hard fail** | Regex scan for volatile status words |
| reference | **Warning** | Imperative rules without enforcer citation logged but not blocking |

## Volatile Status Words (owner-map ban list)

The following patterns are banned in owner-map documents because they
introduce temporal coupling and status drift:

- `TODO`, `FIXME`, `HACK`, `WIP`
- `recently`, `just added`, `new as of`
- `in progress`, `blocked`, `pending`, `done`
- Bare dates matching `20\d{2}-\d{2}(-\d{2})?`
- `changelog`, `history`, `what changed`

Allowed exceptions: dates inside markdown link targets (e.g. plan file names)
and the word "Active" / "Completed" in execution plan status references.

## Adding a New Governed Document

1. Classify the document into one of the six mutation classes
2. Add a row to the **Document Classification** table above
3. If the class requires harness enforcement, add a rule in
   `tests/doc-governance.test.ts`
4. Update `docs/QUALITY.md` if the harness grade changes
