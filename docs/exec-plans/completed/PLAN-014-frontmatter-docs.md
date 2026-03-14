# PLAN-014 — Frontmatter-First Doc Parsing + Intra-File Parity

**Status**: Completed — 2026-03-14
**Goal**: Extend YAML frontmatter to QUALITY.md, tech-debt-tracker.md, and
doc-governance.md, replace bespoke regex parsing with shared utilities, and
enforce an intra-file parity invariant (frontmatter ↔ markdown tables must agree).

## Acceptance Criteria

1. QUALITY.md has YAML frontmatter with package grades and autonomy readiness
2. tech-debt-tracker.md has YAML frontmatter with active/resolved debt IDs
3. doc-governance.md has YAML frontmatter with tier assignments
4. `tests/lib/markdown.ts` provides shared `parseMarkdownTable()` and `extractSection()`
5. All regex table parsing in `consistency.test.ts` and `doc-governance.test.ts`
   replaced with frontmatter reads or the shared parser
6. Intra-file parity tests validate each doc's frontmatter matches its own tables
7. Knowledge store updated: doc-governance.md classification, knowledge-store.md invariant

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Frontmatter per doc, not a central registry | Each doc owns its structured data — same pattern as AGENTS.md |
| Shared `parseMarkdownTable()` for view parsing | Single regex for all tables, one place to fix |
| Intra-file parity as invariant | Prevents frontmatter/table drift within the same file |
| Cross-cutting quality stays table-only | Not per-package structured data; parsed by shared parser |

## Files Expected to Change

| File | Change |
|------|--------|
| `tests/lib/markdown.ts` | NEW — shared table parser |
| `tests/lib/frontmatter.ts` | Add doc-specific loaders + Zod schemas |
| `docs/QUALITY.md` | Add YAML frontmatter |
| `docs/exec-plans/tech-debt-tracker.md` | Add YAML frontmatter |
| `docs/conventions/doc-governance.md` | Add YAML frontmatter for tiers |
| `tests/consistency.test.ts` | Replace regex with frontmatter + shared parser |
| `tests/doc-governance.test.ts` | Replace regex with frontmatter + shared parser |
| `docs/conventions/knowledge-store.md` | Add frontmatter parity invariant |

## Known Risks

- Hand-parser doesn't support YAML arrays — will need to extend
  `parseFrontmatter()` or use a lightweight subset parser
- Frontmatter blocks on docs with many packages may get verbose

## Out of Scope

- Full YAML library dependency (gray-matter) — hand-parser suffices
- Frontmatter for design docs or exec plans beyond tech-debt-tracker
- Automated frontmatter generation from tables
