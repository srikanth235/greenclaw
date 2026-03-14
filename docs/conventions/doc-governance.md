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
| `docs/QUALITY.md` — Grade Tables | state | `## Package Quality`, `## Cross-Cutting Quality`, and `## Autonomy Readiness` |
| `docs/exec-plans/tech-debt-tracker.md` — Resolved | ledger | `## Resolved Debt` table |
| `docs/exec-plans/tech-debt-tracker.md` — Active | state | `## Active Debt` table (rows can move to Resolved) |
| `docs/design/*.md` | decision | Body after status line (when status is Accepted/Verified) |
| `docs/PLANS.md` | index | Plan link table |
| `docs/design/index.md` | index | Design doc table |
| `packages/*/AGENTS.md` — body | owner-map | Everything below the frontmatter `---` block |
| `packages/*/AGENTS.md` — frontmatter | state | YAML between opening and closing `---` delimiters |
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
| reference | **Hard fail** | Imperative rules without enforcer citation block the test suite |

## Volatile Status Words (owner-map ban list)

The following patterns are banned in owner-map documents because they
introduce temporal coupling and status drift:

- `TODO`, `FIXME`, `HACK`, `WIP`
- `recently`, `just added`, `new as of`
- `in progress`, `blocked`, `pending`, `done`
- Bare dates matching `20\d{2}-\d{2}(-\d{2})?`
- `changelog`, `history`, `what changed`

Allowed exceptions:
- Lines inside YAML frontmatter (`---` delimited block at file start)
- Dates inside markdown link targets (e.g. plan file names)
- `Active` / `Completed` in execution plan status references within table cells
- `in progress` in table cells that also reference a `PLAN-NNN`
- `pending` in table cells describing test/implementation/docs status columns
- `done` in table cells that reference a `PLAN-NNN`
- `history` in bulleted feature descriptions (e.g. "Alert event history")

Enforced by `tests/doc-governance.test.ts`.

## Gate Authority

CI (`pnpm test`) is the **authoritative enforcement boundary**. Every
harness and governance check runs in CI via `tests/*.test.ts`. Local
hooks (e.g. `scripts/check-knowledge-store.sh`) are convenience mirrors
that provide faster feedback but are bypassable and not trusted.

Enforced by `.github/workflows/ci.yml` → `pnpm test`.

## Autonomy Tiers

Packages have different blast radii. Higher-tier packages require
stronger evidence before changes are considered safe.

| Tier | Packages | Required Evidence <!-- enforced by tests/consistency.test.ts --> |
| --- | --- | --- |
| **Critical** | `api`, `telemetry` | Contract tests + fixture eval + semantic owner-doc PASS |
| **Standard** | `config`, `optimization`, `monitoring`, `types` | Unit tests + harness pass |
| **Low** | `cli`, `dashboard` | Harness pass |

## Package Frontmatter

Each `packages/*/AGENTS.md` carries YAML frontmatter as the **single source
of truth** for package metadata. Markdown tables in QUALITY.md, CLAUDE.md,
and this file are validated views — they must match the frontmatter values.
Enforced by `tests/consistency.test.ts` (frontmatter-table parity checks).

Schema (validated by Zod in `tests/lib/frontmatter.ts`):

```yaml
---
package: <name>
layer: <0-5>
tier: critical | standard | low
grade: A | B | C | D
autonomy:
  bootable: <bool>
  contract: <bool>
  observable: <bool>
  rollback_safe: <bool>
---
```

The volatile-word scan excludes the frontmatter block. Grade and tier
changes in frontmatter are state-class mutations (require defect log entry).

## Adding a New Governed Document

1. Classify the document into one of the six mutation classes
2. Add a row to the **Document Classification** table above
3. If the class requires harness enforcement, add a rule in
   `tests/doc-governance.test.ts`
4. Update `docs/QUALITY.md` if the harness grade changes
