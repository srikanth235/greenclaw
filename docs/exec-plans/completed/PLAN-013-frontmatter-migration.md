# PLAN-013 — YAML Frontmatter Migration

**Status**: Completed — 2026-03-14
**Goal**: Make each `packages/*/AGENTS.md` the single source of truth for
package metadata (layer, tier, grade, autonomy readiness) via YAML
frontmatter, eliminating duplicated constants across test files.

## Acceptance Criteria

1. Every `packages/*/AGENTS.md` has a YAML frontmatter block with
   `package`, `layer`, `tier`, `grade`, and `autonomy` fields.
2. `tests/lib/frontmatter.ts` provides `loadAllPackageMeta()`,
   `getPackageNames()`, `getPackageOrder()`, `getPackagesByTier()`.
3. All test files (`architecture`, `file-limits`, `module-boundaries`,
   `consistency`) derive their package lists from frontmatter, not
   hardcoded constants.
4. Parity tests validate that QUALITY.md grades, CLAUDE.md layers,
   and doc-governance.md tiers match frontmatter values.
5. Missing or invalid frontmatter causes test failure, not silent skip.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Hand-parse YAML (no gray-matter) | Schema is flat, ~20 lines of parsing |
| Shared utility in `tests/lib/` | Not runtime code, only test infra |
| Parity tests, not generated tables | Fits existing harness pattern |
| Filesystem-based package discovery | Prevents silent package omission (P1 fix) |

## Files Changed

| File | Change |
|------|--------|
| `tests/lib/frontmatter.ts` | NEW — parser, schema, loaders |
| `tests/lib/frontmatter.test.ts` | NEW — unit tests |
| `packages/*/AGENTS.md` (×8) | Added YAML frontmatter blocks |
| `tests/architecture.test.ts` | Use `getPackageOrder()` |
| `tests/file-limits.test.ts` | Use `getPackageNames()` |
| `tests/module-boundaries.test.ts` | Use `getPackageNames()` |
| `tests/consistency.test.ts` | Use frontmatter imports, add parity tests |
| `tests/doc-governance.test.ts` | Skip frontmatter in volatile-word scan |
| `docs/conventions/doc-governance.md` | Document frontmatter governance |
| `docs/conventions/testing.md` | Document shared test utility pattern |

## Known Risks

- Hand-parser doesn't support multi-line YAML values or arrays (not needed
  for current schema, but would need gray-matter if schema grows).
