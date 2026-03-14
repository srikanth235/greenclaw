# GreenClaw — Execution Plans

Plans are first-class artifacts. Complex work is captured in execution plans with
progress notes and decision logs, checked into the repository. Active plans,
completed plans, and known technical debt are all versioned and co-located.

## Active Plans

| Plan | Status | Goal |
| ---- | ------ | ---- |
| [PLAN-015](exec-plans/active/PLAN-015-section-class-frontmatter.md) | Active | Section-to-class mapping in frontmatter |

## Completed Plans

| Plan | Completed | Goal |
| ---- | --------- | ---- |
| [PLAN-014](exec-plans/completed/PLAN-014-frontmatter-docs.md) | 2026-03-14 | Frontmatter-first doc parsing + intra-file parity invariant |
| [PLAN-001](exec-plans/completed/PLAN-001-proxy-skeleton.md) | 2026-03-13 | Transparent passthrough proxy with instrumentation |
| [PLAN-006](exec-plans/completed/PLAN-006-local-telemetry-store.md) | 2026-03-12 | Local observability stack (Pino + SQLite) |
| [PLAN-007](exec-plans/completed/PLAN-007-usage-analytics.md) | 2026-03-12 | Monorepo + usage analytics + budget alerting |
| [PLAN-008](exec-plans/completed/PLAN-008-biome-migration.md) | 2026-03-13 | Migrate ESLint + Prettier to Biome v2 |
| [PLAN-009](exec-plans/completed/PLAN-009-harness-expansion.md) | 2026-03-13 | Harness expansion and contract activation |
| [PLAN-010](exec-plans/completed/PLAN-010-semantic-repo-truth.md) | 2026-03-13 | Semantic repo-truth guards |
| [PLAN-011](exec-plans/completed/PLAN-011-owner-doc-semantic-harness.md) | 2026-03-13 | Owner-doc semantic consistency and claim enforcement |
| [PLAN-012](exec-plans/completed/PLAN-012-doc-governance.md) | 2026-03-14 | Document mutation governance harness |
| [PLAN-013](exec-plans/completed/PLAN-013-frontmatter-migration.md) | 2026-03-14 | YAML frontmatter as single source of truth for package metadata |

## Technical Debt

See [tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) for known debt with
owner, priority, and status.

## Creating a New Plan

1. Create `docs/exec-plans/active/PLAN-NNN-<slug>.md`
2. Use the format from PLAN-001 as a template:
   - **Status**: Active — Week N
   - **Goal**: One sentence
   - **Acceptance Criteria**: Numbered, testable
   - **Files Expected to Change**: Table
   - **Known Risks**: Bulleted
   - **Out of Scope**: Explicit boundaries
3. Add a row to the Active Plans table above

When a plan is complete:

1. Move the file from `active/` to `completed/`
2. Update the status line to "Completed — YYYY-MM-DD"
3. Move the row from Active to Completed in this file
