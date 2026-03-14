# PLAN-015 — Section-to-Class Mapping in Frontmatter

**Status**: Active — Week 1
**Goal**: Make section-to-mutation-class mapping machine-readable in YAML
frontmatter so doc-governance tests discover governed sections automatically
instead of hardcoding heading regexes.

## Acceptance Criteria

1. QUALITY.md frontmatter includes `sections` array mapping headings to mutation classes
2. tech-debt-tracker.md frontmatter includes `sections` array
3. `tests/lib/frontmatter.ts` exports `loadSectionClasses(filePath)` with Zod validation
4. `tests/doc-governance.test.ts` uses frontmatter discovery instead of hardcoded heading regexes
5. Parity test verifies declared section headings exist in the document
6. doc-governance.md updated to note frontmatter-driven section discovery

## Files Expected to Change

| File | Change |
|------|--------|
| `docs/QUALITY.md` | Add `sections` to frontmatter |
| `docs/exec-plans/tech-debt-tracker.md` | Add `sections` to frontmatter |
| `tests/lib/frontmatter.ts` | Add `SectionClassSchema`, `loadSectionClasses()` |
| `tests/doc-governance.test.ts` | Replace hardcoded headings with frontmatter discovery |
| `tests/consistency.test.ts` | Add section-heading existence parity test |
| `docs/conventions/doc-governance.md` | Note frontmatter-driven discovery |
| `docs/PLANS.md` | Add PLAN-015 to Active table |

## Known Risks

- Whole-file governed docs (CLAUDE.md, AGENTS.md, conventions/*.md) don't need `sections` — only section-level governed docs get this treatment
- The hand-rolled YAML parser must handle arrays of flow maps (already supported from PLAN-014)

## Out of Scope

- Per-section governance for whole-file docs (owner-map, reference classes)
- Changing mutation class definitions themselves
