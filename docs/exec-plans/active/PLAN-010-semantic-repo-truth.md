# PLAN-010 — Semantic Repo-Truth Guards

**Status**: Active — Week 1
**Goal**: Replace structural-only doc checks with semantic parity tests that catch real drift between documentation claims and executable truth, then close the first review gaps in the new harnesses.

## Acceptance Criteria

1. Knowledge gate rejects `packages/<pkg>/src/` changes that lack the correct companion doc update (not just "any" doc)
2. README commands like `pnpm dev`, `pnpm start`, and `pnpm lint` match `package.json` scripts and actual startup/tooling behavior
3. `.env.example` variables match what `packages/config/src/` actually reads from `env.*` / `process.env.*`, with security-only exceptions explicitly documented
4. Timeless docs (design/, references/, conventions/) do not contain volatile status prose
5. Low-signal structural checks (line-count limits, heading consistency) are removed
6. Knowledge gate requires package owner docs and package-specific companion docs instead of broad `docs/**` fallbacks
7. All existing passing tests continue to pass after drift in README, observability docs, and `.env.example` is fixed

## Files Expected to Change

| File | Change |
|------|--------|
| `tests/knowledge-gate.test.ts` | Require package AGENTS docs and package-specific companion docs |
| `tests/consistency.test.ts` | Replace no-op env scan, tighten README/env contracts |
| `packages/api/src/main.ts` | Add thin runtime entrypoint for `pnpm dev` / `pnpm start` |
| `package.json` | Add runnable `dev` and `start` scripts |
| `packages/api/AGENTS.md` | Document runtime entrypoint ownership and shutdown invariants |
| `docs/conventions/testing.md` | Add semantic doc-contract category |
| `docs/QUALITY.md` | Defect log entry for knowledge-gate no-op bug |
| `README.md` | Restore truthful Quick Start and built runtime instructions |
| `.env.example` | Expand to full config env surface, keep only documented security secrets |
| `docs/conventions/observability.md` | Fix stale `LOG_LEVEL` reference |
| `docs/PLANS.md` | Add PLAN-010 row |
| `CLAUDE.md` | Add PLAN-010 row |

## Known Risks

- Status-doc boundary check may produce false positives on legitimate forward-looking language in convention docs; mitigate with a curated phrase list
- Path-specific gate rules need maintenance when new packages are added
- Runtime entrypoint should stay thin; avoid duplicating dependency wiring outside `api/`

## Out of Scope

- CLI command dispatch validation (brittle, couples to framework internals)
- Automated doc gardening / scheduled cleanup jobs
- QUALITY.md grade-vs-reality verification (requires defining "stub" mechanically)
