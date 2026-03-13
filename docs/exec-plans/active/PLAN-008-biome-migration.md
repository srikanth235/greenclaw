# PLAN-008: Migrate from ESLint + Prettier to Biome v2

## Status

Active — Week 1

## Goal

Replace ESLint 8 + Prettier 3 + lint-staged (6 npm packages) with Biome v2
(1 package) for unified linting and formatting with 15-25x speed improvement.

## Acceptance Criteria

1. **Biome replaces ESLint and Prettier**
   - Single `biome.json` config at root
   - `.eslintrc.cjs`, `.prettierrc`, `.prettierignore` deleted
   - `eslint`, `@typescript-eslint/*`, `eslint-plugin-jsdoc`, `prettier`,
     `lint-staged` removed from devDependencies

2. **All custom rules replicated**
   - Layer dependency enforcement via `noRestrictedImports` overrides
   - `noConsole` in `packages/*/src/**`
   - `noProcessEnv` globally, disabled for `packages/config/**` and tests
   - `noExplicitAny`, `noUnusedVariables` at error level

3. **Layer semantics corrected**
   - Same-layer packages can import each other (optimization <-> monitoring,
     cli <-> api), matching CLAUDE.md layer definitions

4. **JSDoc enforcement via vitest harness**
   - New `tests/jsdoc-hygiene.test.ts` scans exported declarations for
     preceding JSDoc blocks (warn-level, matching prior ESLint severity)

5. **Pre-commit uses Biome native --staged**
   - lint-staged eliminated; `biome check --staged` in `.husky/pre-commit`

6. **Build and CI**
   - `pnpm typecheck` passes with zero errors
   - `pnpm lint` passes (now runs `biome check`)
   - `pnpm test` passes including new jsdoc-hygiene harness

## Files Expected to Change

| File                                           | Change                                   |
| ---------------------------------------------- | ---------------------------------------- |
| `biome.json`                                   | New: full Biome config with overrides    |
| `package.json`                                 | Scripts, deps, remove lint-staged config |
| `.husky/pre-commit`                            | Replace lint-staged with biome --staged  |
| `.eslintrc.cjs`                                | Deleted                                  |
| `.prettierrc`                                  | Deleted                                  |
| `.prettierignore`                              | Deleted                                  |
| `tests/jsdoc-hygiene.test.ts`                  | New: JSDoc harness test                  |
| `CONTRIBUTING.md`                              | Update tool references                   |
| `docs/conventions/testing.md`                  | Add jsdoc-hygiene row                    |
| `docs/QUALITY.md`                              | Update cross-cutting tool references     |
| `docs/PLANS.md`                                | Add PLAN-008 row                         |
| `docs/exec-plans/active/PLAN-006-*.md`         | Update `.eslintrc.cjs` reference         |
| `.github/workflows/ci.yml`                     | Update lint step label                   |

## Known Risks

- **Formatting diff**: Biome formatter may produce slightly different output
  than Prettier in edge cases. Commit formatting changes separately.
- **JSDoc test false positives**: Regex-based JSDoc detection may miss
  complex export patterns. Start at warn level, tune before upgrading.
- **Biome version churn**: Pin exact version to avoid surprises.

## Out of Scope

- Type-aware linting (Biome's type inference covers ~85% of typescript-eslint)
- GritQL custom plugins (not needed for current rule set)
- Biome CSS/HTML/Markdown formatting (not used in this project)
