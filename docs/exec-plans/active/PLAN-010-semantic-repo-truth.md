# PLAN-010 — Semantic Repo-Truth Guards

**Status**: Active — Week 1
**Goal**: Replace structural-only doc checks with semantic parity tests that catch real drift between documentation claims and executable truth.

## Acceptance Criteria

1. Knowledge gate rejects `packages/<pkg>/src/` changes that lack the correct companion doc update (not just "any" doc)
2. README commands like `pnpm dev`, `pnpm lint` descriptions match `package.json` scripts and actual tooling
3. `.env.example` variables match what `packages/config/src/` actually reads from `process.env`
4. Timeless docs (design/, references/, conventions/) do not contain volatile status prose
5. Low-signal structural checks (line-count limits, heading consistency) are removed
6. All existing passing tests continue to pass after drift in README and .env.example is fixed

## Files Expected to Change

| File | Change |
|------|--------|
| `tests/knowledge-gate.test.ts` | Fix `src/` → `packages/`, add path-specific rule table |
| `tests/consistency.test.ts` | Remove low-signal checks, add semantic contract blocks |
| `docs/conventions/testing.md` | Add semantic doc-contract category |
| `docs/QUALITY.md` | Defect log entry for knowledge-gate no-op bug |
| `README.md` | Fix ESLint/Prettier → Biome, remove `pnpm dev` |
| `.env.example` | Remove orphan `LOG_LEVEL` |
| `docs/PLANS.md` | Add PLAN-010 row |
| `CLAUDE.md` | Add PLAN-010 row |

## Known Risks

- Status-doc boundary check may produce false positives on legitimate forward-looking language in convention docs; mitigate with a curated phrase list
- Path-specific gate rules need maintenance when new packages are added

## Out of Scope

- CLI command dispatch validation (brittle, couples to framework internals)
- Automated doc gardening / scheduled cleanup jobs
- QUALITY.md grade-vs-reality verification (requires defining "stub" mechanically)
