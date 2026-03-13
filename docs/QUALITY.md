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

## Package Quality

| Package       | Implementation | Tests         | Docs     | Grade | Notes                                |
| ------------- | -------------- | ------------- | -------- | ----- | ------------------------------------ |
| types/        | Partial        | N/A           | Complete | C     | Alert Zod schemas implemented        |
| config/       | Stub           | N/A           | Complete | D     | Env var loading not yet implemented  |
| telemetry/    | Functional     | Comprehensive | Complete | B     | Pino + SQLite + getDb() accessor     |
| optimization/ | Functional     | Basic          | Complete | C     | Classifier, compactor (CompactResult), router (tier-aware provider) |
| monitoring/   | Functional     | Pending       | Complete | C     | UsageStore + alert CRUD + evaluation |
| cli/          | Functional     | Pending       | Complete | C     | usage/alerts/traces subcommands      |
| api/          | Functional     | Comprehensive | Complete | B     | Proxy with header sanitization, timeout, error handling |
| dashboard/    | Stub           | N/A           | Complete | D     | Built last per plan                  |

## Cross-Cutting Quality

| Domain                     | Status     | Grade | Notes                                                     |
| -------------------------- | ---------- | ----- | --------------------------------------------------------- |
| Architecture enforcement   | Active     | B     | Layer deps, pure-function-layers, circular dep detection  |
| Consistency checks         | Active     | A     | AGENTS.md sync, naming, module map, QUALITY, PLANS        |
| Harness: doc integrity     | Active     | A     | Doc backlinks, AGENTS.md structure, convention coverage   |
| Harness: file limits       | Active     | B     | Source file max 300 lines + test-file-per-module          |
| Harness: module boundaries | Active     | B     | No deep imports, no hardcoded models, no PII in logs      |
| Harness: docs freshness    | Active     | B     | Design doc status validation, plan lifecycle checks       |
| Harness: Biome layers      | Active     | B     | `noRestrictedImports` enforces layer boundaries           |
| Harness: no-console        | Active     | B     | Biome `noConsole` in packages/src/ enforces structured logging |
| Harness: process.env gate  | Active     | A     | Biome `noProcessEnv` bans `process.env` outside config/   |
| Harness: JSDoc hygiene     | Active     | B     | AST harness blocks missing exported JSDoc and callable tags |
| Harness: skip hygiene      | Active     | A     | No unmanaged it.skip/describe.skip without allowlist      |
| Harness: suppression hygiene | Active   | B     | TODO/ignore directives require linked PLAN/TD ownership    |
| Harness: knowledge gate    | Active     | A     | Deterministic CI: packages/ changes require docs/ changes |
| Harness: side-effect ban   | Active     | A     | Timers, Math.random, Date.now banned in pure layers       |
| Harness: telemetry contracts | Active   | B     | Logger JSON, trace shape, and SQLite schema parity checks  |
| Harness: proxy contracts   | Active     | B     | Passthrough, only-model-mutates, health, SSE parity       |
| Error conventions          | Documented | B     | Schema defined, not yet implemented in api/               |
| Observability              | Active     | B     | Shared RequestTrace schema, persistence, and query contracts |
| Security                   | Active     | B     | Header sanitization, upstream timeout, trace error isolation |
| CI pipeline                | Partial    | B     | Lint + typecheck + test, no integration tests yet         |

## Tracking Gaps

When you complete work on a module, update both the grade and the notes column.
The goal is to reach grade B across all modules before any module reaches A —
breadth before depth.

## Defect Log

- 2026-03-12: Fixed a false negative in `tests/architecture.test.ts` where
  comment text containing `fetch` could suppress real `fetch()` violation
  detection in pure pipeline modules.
- 2026-03-12: Fixed three P2 bugs in telemetry module — logger JSON key
  mismatch, silent SQLite init failure, and timezone-aware time-range queries.

- 2026-03-12: Added process.env restriction ESLint rule, no-unmanaged-skips
  harness test, deterministic knowledge-store CI gate, extended pure-module
  I/O ban (timers, Math.random, Date.now), and proxy contract test stubs
  (upstream passthrough, only-model-mutates, boot smoke test).

- 2026-03-12: Restructured to pnpm workspace monorepo (PLAN-007). Added
  @greenclaw/monitoring (usage analytics + alerts), @greenclaw/cli, and
  OpenClaw skill. Consolidated classifier/compactor/router into
  @greenclaw/optimization.

- 2026-03-12: PR review fixes — (1) exposed greenclaw bin at workspace
  root so SKILL.md commands work from a fresh checkout, (2) added Zod
  validation in `alerts set` to reject invalid metric/unit/period/threshold,
  (3) added UNIQUE(rule_id, period_start) constraint on alert_events
  and switched to INSERT OR IGNORE for atomic deduplication.

- 2026-03-12: Follow-up PR review fixes — corrected malformed `npx greenclaw`
  skill commands and tightened `alerts set` semantic validation so invalid
  metric/unit/period/model combinations are rejected before persistence.

- 2026-03-12: Tooling fix — root lint and staged ESLint checks now use
  `pnpm exec eslint` so clean checkouts do not accidentally resolve a global
  ESLint 9 binary against the repo's legacy `.eslintrc.cjs` config.

- 2026-03-13: Migrated from ESLint 8 + Prettier 3 + lint-staged to Biome v2
  (PLAN-008). Corrected layer semantics: same-layer packages (optimization
  <-> monitoring, cli <-> api) can now import each other per CLAUDE.md.
  JSDoc enforcement moved to vitest harness test.

- 2026-03-13: Fixed the initial Biome migration regression where
  `tests/jsdoc-hygiene.test.ts` only warned and under-scanned exported
  declarations. The harness now fails on missing exported JSDoc and missing
  `@param` / `@returns` tags for exported callables.

- 2026-03-13: Added PLAN-009 harness expansion work: package-aware knowledge
  gate, suppression hygiene, telemetry contract checks, shared request/health
  schemas, and live proxy/classifier contract activation.

- 2026-03-13: PR #5 review fixes — (1) compact() returns CompactResult tuple
  instead of relying on reference equality, (2) startServer rejects on error,
  (3) createApp skips createDefaultDependencies when all deps injected,
  (4) proxy strips hop-by-hop and sensitive headers (cookie, host, etc.),
  (5) upstream fetch uses AbortSignal.timeout(30s), (6) insertTrace wrapped
  in try/catch to prevent telemetry failures crashing requests, (7) router
  uses tier-based provider instead of hardcoded COMPLEX, (8) root tests use
  package name imports, (9) added 400/502 path tests in api.test.ts,
  (10) removed redundant null guards in app.ts, (11) exported traceToRow
  from @greenclaw/telemetry public API.

Last updated: 2026-03-13
