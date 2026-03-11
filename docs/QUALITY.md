# GreenClaw — Quality Scorecard

Quality grade per module and architectural domain. Updated as implementation
progresses. Use this document to identify gaps and prioritize work.

## Grading Scale

| Grade | Meaning                                                     |
| ----- | ----------------------------------------------------------- |
| A     | Production-ready: implemented, tested, documented, reviewed |
| B     | Functional: implemented with minor gaps in tests or docs    |
| C     | Implemented: core logic works but incomplete coverage       |
| D     | Stub: not yet implemented                                   |

## Module Quality

| Module      | Implementation | Tests         | Docs     | Grade | Notes                               |
| ----------- | -------------- | ------------- | -------- | ----- | ----------------------------------- |
| types/      | Stub           | N/A           | Complete | D     | Zod schemas not yet defined         |
| config/     | Stub           | N/A           | Complete | D     | Env var loading not yet implemented |
| classifier/ | Stub           | Fixture ready | Complete | D     | Returns COMPLEX as placeholder      |
| compactor/  | Stub           | N/A           | Complete | D     | Returns input unchanged             |
| router/     | Stub           | N/A           | Complete | D     | Returns default provider model      |
| api/        | Stub           | N/A           | Complete | D     | Hono app not yet wired              |
| dashboard/  | Stub           | N/A           | Complete | D     | Built last per plan                 |

## Cross-Cutting Quality

| Domain                   | Status     | Grade | Notes                                              |
| ------------------------ | ---------- | ----- | -------------------------------------------------- |
| Architecture enforcement | Active     | B     | `tests/architecture.test.ts` exists but skipped    |
| Consistency checks       | Active     | A     | AGENTS.md sync, naming, module structure validated |
| Error conventions        | Documented | B     | Schema defined, not yet implemented in api/        |
| Observability            | Documented | D     | RequestTrace schema defined, no persistence yet    |
| Security                 | Documented | C     | Conventions written, implementation pending        |
| CI pipeline              | Partial    | B     | Lint + typecheck + test, no integration tests yet  |

## Tracking Gaps

When you complete work on a module, update both the grade and the notes column.
The goal is to reach grade B across all modules before any module reaches A —
breadth before depth.

Last updated: 2026-03-11
