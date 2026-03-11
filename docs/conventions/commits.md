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
