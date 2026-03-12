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

| Domain                     | Status     | Grade | Notes                                                    |
| -------------------------- | ---------- | ----- | -------------------------------------------------------- |
| Architecture enforcement   | Active     | B     | Layer deps, pure-function-layers, circular dep detection |
| Consistency checks         | Active     | A     | AGENTS.md sync, naming, module map, QUALITY, PLANS       |
| Harness: doc integrity     | Active     | A     | Doc backlinks, AGENTS.md structure, convention coverage  |
| Harness: file limits       | Active     | B     | Source file max 300 lines + test-file-per-module         |
| Harness: module boundaries | Active     | B     | No deep imports, no hardcoded models, no PII in logs     |
| Harness: docs freshness    | Active     | B     | Design doc status validation, plan lifecycle checks      |
| Harness: ESLint layers     | Active     | B     | `no-restricted-imports` enforces layer boundaries        |
| Harness: no-console        | Active     | B     | `no-console` in src/ enforces structured logging         |
| Harness: process.env gate  | Active     | A     | ESLint bans `process.env` outside config/                |
| Harness: skip hygiene      | Active     | A     | No unmanaged it.skip/describe.skip without allowlist     |
| Harness: knowledge gate    | Active     | A     | Deterministic CI: src/ changes require docs/ changes     |
| Harness: side-effect ban   | Active     | A     | Timers, Math.random, Date.now banned in pure layers      |
| Harness: proxy contracts   | Documented | D     | Passthrough, only-model-mutates, boot smoke (skipped)    |
| Error conventions          | Documented | B     | Schema defined, not yet implemented in api/              |
| Observability              | Documented | D     | RequestTrace schema defined, no persistence yet          |
| Security                   | Documented | C     | Conventions written, implementation pending              |
| CI pipeline                | Partial    | B     | Lint + typecheck + test, no integration tests yet        |

## Tracking Gaps

When you complete work on a module, update both the grade and the notes column.
The goal is to reach grade B across all modules before any module reaches A —
breadth before depth.

## Defect Log

- 2026-03-12: Fixed a false negative in `tests/architecture.test.ts` where
  comment text containing `fetch` could suppress real `fetch()` violation
  detection in pure pipeline modules.

- 2026-03-12: Added process.env restriction ESLint rule, no-unmanaged-skips
  harness test, deterministic knowledge-store CI gate, extended pure-module
  I/O ban (timers, Math.random, Date.now), and proxy contract test stubs
  (upstream passthrough, only-model-mutates, boot smoke test).

Last updated: 2026-03-12
