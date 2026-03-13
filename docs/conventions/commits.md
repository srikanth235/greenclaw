# GreenClaw — Commit Conventions

## Format

Every commit message follows
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature or capability                               |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation-only change                               |
| `test`     | Adding or updating tests (no production code)           |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore`    | Tooling, config, CI, dependency updates                 |
| `style`    | Formatting, whitespace (no logic change)                |
| `perf`     | Performance improvement                                 |
| `ci`       | CI/CD pipeline changes                                  |

### Scope (optional)

Use the module name when the change is scoped to a single module:

```
feat(router): add weighted random provider selection
fix(classifier): handle empty message arrays
docs(config): update env var table in AGENTS.md
```

Omit scope for cross-cutting or project-wide changes.

### Description

- Imperative mood, lowercase, no trailing period
- Complete the sentence: "This commit will ..."

### Examples

```
feat(api): add health check endpoint
fix(compactor): preserve system messages during compaction
docs: add conventional commits convention
test(classifier): add fixture tests for code-generation prompts
refactor(types): split schemas into per-domain files
chore: upgrade vitest to v3
```

## Rules

1. **One type per commit** — don't mix `feat` and `fix` in the same commit.
2. **Breaking changes** — add `!` after the type/scope and explain in the
   footer: `feat(api)!: change auth header name`.
3. **Docs-first** — when a commit includes both docs and code, use the code
   type (`feat`, `fix`, etc.), not `docs`.

## Pre-commit: knowledge-store check

A pre-commit hook (`scripts/check-knowledge-store.sh`) enforces the
knowledge-store-first rule from CLAUDE.md using the Codex CLI.

### How it works

1. If no `src/` files are staged, the check is skipped (docs-only, test-only,
   and config-only commits pass freely).
2. When `src/` files are staged, the hook pipes the staged diff to
   `codex exec`, which verifies that all required knowledge store updates are
   present for the code changes.
3. The LLM responds with `PASS:` or `FAIL:` plus a reason.
4. `FAIL` blocks the commit and explains which docs need updating.

### Bypass

For rare exceptions (CI-only changes, etc.):

```sh
SKIP_KNOWLEDGE_CHECK=1 git commit -m "ci: update workflow"
```

### Requirements

The `codex` CLI must be installed and authenticated. If it is not available
the commit is blocked.

## Pre-commit: Biome staged check

The Husky pre-commit hook runs Biome on staged files before tests.

### How it works

1. `pnpm exec biome check --write --staged --error-on-warnings` formats and
   lints staged files using the repo's Biome config.
2. `git update-index --again` re-stages any files rewritten by Biome.
3. Warnings and errors fail the hook via Biome's exit code.
4. `pnpm test` runs after the staged-file check passes.
