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

Package A-grades require:

- deterministic coverage for the package's normative behavioral guarantees
- latest owner-doc semantic verdict recorded as PASS in the notes column

## Package Quality

| Package       | Implementation | Tests         | Docs     | Grade | Notes                                |
| ------------- | -------------- | ------------- | -------- | ----- | ------------------------------------ |
| types/        | Functional     | Basic         | Complete | B     | Alert, proxy, and telemetry schemas exported from Zod |
| config/       | Functional     | Basic         | Complete | C     | Env parsing + tier defaults; reparses env per call |
| telemetry/    | Functional     | Comprehensive | Complete | B     | Pino + SQLite + getDb() accessor     |
| optimization/ | Functional     | Basic         | Complete | C     | Deterministic classifier/router; compactor still pass-through |
| monitoring/   | Functional     | Basic         | Complete | C     | UsageStore + alert CRUD + evaluation |
| cli/          | Functional     | Pending       | Complete | C     | usage/alerts/traces subcommands      |
| api/          | Functional     | Comprehensive | Complete | B     | Proxy with header sanitization, timeout, error handling |
| dashboard/    | Stub           | Basic         | Complete | D     | Placeholder status export only       |

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
| Harness: knowledge gate    | Active     | B     | Path-specific owner-doc and companion-doc relevance gate  |
| Harness: semantic owner-docs | Active   | B     | Trusted-CI / opt-in Codex check for `packages/*/AGENTS.md` |
| Harness: side-effect ban   | Active     | A     | Timers, Math.random, Date.now banned in pure layers       |
| Harness: telemetry contracts | Active   | B     | Logger JSON, trace shape, and SQLite schema parity checks  |
| Harness: proxy contracts   | Active     | B     | Passthrough, only-model-mutates, health, SSE parity       |
| Harness: fixture eval      | Active     | B     | Classifier accuracy dataset is active and blocking        |
| Error conventions          | Documented | C     | Docs updated to current API behavior; broader error map deferred |
| Observability              | Active     | B     | Shared RequestTrace schema, persistence, and query contracts |
| Security                   | Active     | B     | Header sanitization, upstream timeout, trace error isolation |
| Harness: doc governance    | Active     | B     | Ledger append-only, grade-note coupling, owner-map volatile ban, reference enforcer citation |
| CI pipeline                | Partial    | B     | Deterministic suite is always on; semantic lane requires Codex auth |

## Autonomy Readiness

Per-package readiness for autonomous development without human intervention.
Criteria: Bootable (imports without external config), Contract-Covered (blocking
contract/fixture tests in CI), Observable (structured logs/traces), Rollback-Safe
(no irreversible side effects).

| Package       | Bootable | Contract | Observable | Rollback-Safe | Score |
| ------------- | -------- | -------- | ---------- | ------------- | ----- |
| types/        | Yes      | No       | No         | Yes           | 2/4   |
| config/       | Yes      | No       | No         | Yes           | 2/4   |
| telemetry/    | Yes      | Yes      | Yes        | Yes           | 4/4   |
| optimization/ | Yes      | Yes      | No         | Yes           | 3/4   |
| monitoring/   | Yes      | No       | No         | Yes           | 2/4   |
| cli/          | Yes      | No       | No         | Yes           | 2/4   |
| api/          | Yes      | Yes      | Yes        | Yes           | 4/4   |
| dashboard/    | Yes      | No       | No         | Yes           | 2/4   |

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

- 2026-03-13: Added knowledge-store claim taxonomy, deterministic repo-truth
  parity checks, path-specific knowledge gate rules, semantic owner-doc
  harness scaffolding, and trusted-CI semantic lane wiring. Tightened stale
  owner docs, README/tooling/runtime docs, and runtime bootstrap parity.

- 2026-03-13: Semantic owner-doc follow-up — corrected `types/` and
  `telemetry/` dependency/configurability claims and made `config.loadConfig()`
  return a deep-frozen object so the immutability invariant is mechanically true.

- 2026-03-14: Added PLAN-012 document governance harness — mutation class
  taxonomy (ledger, state, decision, index, owner-map, reference), convention
  doc, and git-diff-based test enforcing append-only defect log, grade-note
  coupling, owner-map volatile-word ban, and reference enforcer citation checks.

- 2026-03-14: Fixed CI workflow YAML parse error — secrets context not allowed
  in job-level `if` conditions. Replaced with `vars.ENABLE_SEMANTIC_HARNESS`
  repository variable. Added `push` trigger so CI runs on merges to main.

- 2026-03-14: Tightened doc-governance harness per review — (1) CI semantic job
  gates auth steps on secrets availability to prevent fork PR failures,
  (2) grade-change check now covers cross-cutting quality rows with spaces,
  (3) defect log append-only validates full entry blocks including continuation
  lines, (4) resolved debt compares full row content not just IDs, (5) added
  missing `done` and `history` to volatile-word ban list with precise exemptions.

- 2026-03-14: Autonomy hardening — (1) promoted reference-class enforcement
  from warning to hard fail, (2) documented CI as authoritative gate (local
  hooks are convenience only), (3) added per-package autonomy readiness table
  with bootable/contract/observable/rollback-safe criteria, (4) added autonomy
  tiers (critical/standard/low) with grade floor enforcement for critical
  packages. Follow-up: added state-class enforcement for autonomy readiness
  value changes (requires defect log entry), strengthened tier validation to
  verify contract/fixture test existence, unique tier assignment, and semantic
  PASS requirement for A-grade critical packages.

Last updated: 2026-03-14
