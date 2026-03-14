# Contributing to GreenClaw

## For humans and AI agents alike

This guide defines the conventions that keep GreenClaw's codebase healthy.
Follow these rules whether you're writing code by hand or generating it with
an AI agent.

## Name guardrail

This product is **GreenClaw**. Never use "ClawProxy", "InferenceProxy", or
any other name in code, docs, comments, or variable names. CI enforces this.

## Change lifecycle

Every change follows a docs-first workflow. Documentation is not an
afterthought — it is the plan that guides implementation.

| Step           | Action                                                   | When to skip                       |
| -------------- | -------------------------------------------------------- | ---------------------------------- |
| 1. **Plan**    | Create an execution plan in `docs/exec-plans/active/`    | Small bug fixes, single-file edits |
| 2. **Decide**  | Write an ADR in `docs/design/` for non-obvious choices   | Obvious or already-decided choices |
| 3. **Design**  | Define module ownership in `src/<module>/AGENTS.md`      | Changes to existing modules only   |
| 4. **Update**  | Update the knowledge store (AGENTS.md, QUALITY.md, etc.) | Never skip                         |
| 5. **Build**   | Implement the code                                       | Never skip                         |
| 6. **Enforce** | Update tests (architecture, consistency, unit)           | No new modules or docs             |
| 7. **Verify**  | `pnpm typecheck && pnpm lint && pnpm test`               | Never skip                         |

**For new modules**: all 7 steps required.
**For new features**: steps 1, 4–7 required (ADR only if non-obvious).
**For bug fixes**: steps 4–7 (update QUALITY.md if relevant, write a test).

**Knowledge store first**: write or update docs _before_ writing application
code. Ship both in the same commit, but always write the doc first — it
drives the implementation, not the other way around. See CLAUDE.md for the
full enforcement rules.

## Adding code to an existing module

1. Read the module's `AGENTS.md` before touching any file in that directory.
2. Only import from modules at the **same or lower** layer:
   ```
   types → config → classifier → compactor → router → api → dashboard
   ```
3. Run `pnpm typecheck && pnpm lint && pnpm test` before committing.
4. Root scripts and hooks must invoke repository-pinned CLIs via `pnpm exec`
   when they rely on local tool versions. Do not depend on globally installed
   `biome` or similar binaries.

## Adding a new module

1. Create `src/<module>/index.ts` and `src/<module>/AGENTS.md`.
2. Add the module to the `LAYER_ORDER` array in `tests/architecture.test.ts`.
3. Add the module to the `MODULES` array in `tests/consistency.test.ts`.
4. Add a row to the root `AGENTS.md` module map table.
5. Add a row to `docs/QUALITY.md` module quality table.
6. Keep the new `AGENTS.md` under 80 lines.

## Type definitions

- All external data shapes are Zod schemas in `src/types/`.
- Derive TypeScript types via `z.infer<>`. Never declare standalone `interface`
  or `type` for API contracts.
- See [005-zod-as-source-of-truth](docs/design/005-zod-as-source-of-truth.md).

## JSDoc requirements

All exported functions, classes, interfaces, and type aliases require a
preceding JSDoc block. Exported functions and methods must also document their
parameters with `@param` tags, and non-void returns with `@returns`. The
`tests/jsdoc-hygiene.test.ts` harness enforces this with an AST-based scan.

```typescript
/**
 * Classify a chat completion request into a task tier.
 * @param messages - The conversation messages
 * @param model - The requested model name
 * @returns The classified task tier
 */
export function classify(messages: ChatMessage[], model: string): TaskTier {
```

## Error handling

Follow the conventions in [docs/conventions/errors.md](docs/conventions/errors.md):

- GreenClaw-generated errors (auth failures, internal errors) use a simple JSON
  error format. Upstream provider errors are forwarded as-is.
- Never leak upstream API keys or internal URLs in error messages.
- Classifier and compactor never throw — they return safe fallbacks.

## Testing

See [docs/conventions/testing.md](docs/conventions/testing.md) for full testing
conventions, harness test descriptions, and guidelines for new test files.

Key tests:

- **Architecture test**: `tests/architecture.test.ts` enforces layer rules.
- **Consistency test**: `tests/consistency.test.ts` validates AGENTS.md sync and doc cross-links.
- **Classifier fixture**: `tests/classifier.fixture.test.ts` requires ≥90% accuracy.
- Write tests for new functionality. Use Vitest.

## Commit workflow

All commits use [Conventional Commits](https://www.conventionalcommits.org/)
format. See [docs/conventions/commits.md](docs/conventions/commits.md) for the
full type table and examples.

```
<type>(<scope>): <description>
```

## CI pipeline

CI runs on both `push` to main and `pull_request` targeting main. Two jobs:

1. **check** — typecheck, lint, test (always runs)
2. **semantic-owner-docs** — LLM-backed owner-doc consistency check (runs only
   when `vars.ENABLE_SEMANTIC_HARNESS` is set to `'true'` in repository settings)

Pre-commit hooks run automatically:

1. **Knowledge-store check** — uses the Codex CLI to verify that all required
   doc updates are present when `src/` files are staged. See
   [docs/conventions/commits.md](docs/conventions/commits.md) for details.
   Bypass with `SKIP_KNOWLEDGE_CHECK=1`.
2. **Biome** — auto-fix lint + format on staged files (`biome check --write --staged --error-on-warnings`), then re-stage fixed files. Any remaining warnings or errors block the commit.
3. **Tests** — `pnpm test`.

Hook commands must resolve tools from this workspace, not from the user's
global environment. Prefer `pnpm exec <tool>` in root scripts and hook config
when a command depends on the repo's pinned tool version.

If any hook fails, fix the issue before committing.

## Architecture Decision Records

Any non-obvious design choice requires a design doc in `docs/design/` before
implementation begins. Assign the next sequential number and use the format:

```
# NNN-slug: Title
## Status (Proposed | Accepted | Deprecated)
## Context
## Options Considered
## Decision
## Consequences
```

## Observability

Every proxied request must emit a `RequestTrace` to structured logging.
See [docs/conventions/observability.md](docs/conventions/observability.md)
for the schema and conventions.
