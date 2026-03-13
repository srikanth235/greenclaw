# GreenClaw — Execution Plans

Plans are first-class artifacts. Complex work is captured in execution plans with
progress notes and decision logs, checked into the repository. Active plans,
completed plans, and known technical debt are all versioned and co-located.

## Active Plans

| Plan                                                            | Status          | Goal                                               |
| --------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| [PLAN-001](exec-plans/active/PLAN-001-proxy-skeleton.md)        | Active — Week 1 | Transparent passthrough proxy with instrumentation |
| [PLAN-006](exec-plans/active/PLAN-006-local-telemetry-store.md) | Active — Week 1 | Local observability stack (Pino + SQLite)          |
| [PLAN-007](exec-plans/active/PLAN-007-usage-analytics.md)       | Active — Week 1 | Monorepo + usage analytics + budget alerting       |
| [PLAN-008](exec-plans/active/PLAN-008-biome-migration.md)       | Active — Week 1 | Migrate ESLint + Prettier to Biome v2              |
| [PLAN-009](exec-plans/active/PLAN-009-harness-expansion.md)     | Active — Week 2 | Harness expansion and contract activation          |
| [PLAN-010](exec-plans/active/PLAN-010-semantic-repo-truth.md)   | Active — Week 1 | Semantic repo-truth guards                         |
| [PLAN-011](exec-plans/active/PLAN-011-owner-doc-semantic-harness.md) | Active — Week 1 | Owner-doc semantic consistency harness             |
| [PLAN-012](exec-plans/active/PLAN-012-semantic-contract-followups.md) | Active — Week 1 | Semantic claim enforcement and contract follow-ups |

## Completed Plans

| Plan       | Completed | Goal |
| ---------- | --------- | ---- |
| (none yet) |           |      |

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
4. Add a row to root `AGENTS.md` execution plans table

When a plan is complete:

1. Move the file from `active/` to `completed/`
2. Update the status line to "Completed — YYYY-MM-DD"
3. Move the row from Active to Completed in this file
