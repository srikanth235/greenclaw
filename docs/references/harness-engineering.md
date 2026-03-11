# Harness Engineering — Key Principles

> Reference extracted from "Harness engineering: leveraging Codex in an
> agent-first world" by Ryan Lopopolo (OpenAI, 2025).
> This document captures the principles we adopt for GreenClaw.

---

## Core Philosophy

**Humans steer. Agents execute.**

The engineer's primary job is not to write code, but to design
environments, specify intent, and build feedback loops that allow agents
to do reliable work. The scarce resource is human time and attention —
everything else should be optimised to maximise leverage on that resource.

---

## 1. Redefining the Role of the Engineer

- Engineering work shifts to **systems, scaffolding, and leverage**.
- Early slowness is usually caused by an underspecified environment, not
  agent incapability. The agent lacks tools, abstractions, and internal
  structure to make progress.
- Work depth-first: break larger goals into smaller building blocks
  (design, code, review, test), have the agent construct those blocks,
  then compose them into larger tasks.
- When something fails, ask: "what capability is missing, and how do we
  make it both legible and enforceable for the agent?"

---

## 2. Increasing Application Legibility

Make the application itself directly legible to agents:

- **Bootable per worktree** — one app instance per change so the agent can
  launch, drive, and observe it in isolation.
- **UI accessible** — wire DevTools Protocol (or equivalent) into the agent
  runtime; create skills for DOM snapshots, screenshots, navigation.
- **Observability accessible** — expose logs, metrics, and traces via a
  local ephemeral stack per worktree. Agents query logs (LogQL) and
  metrics (PromQL) directly.
- These capabilities make performance and correctness prompts tractable
  (e.g. "ensure startup completes in under 800 ms").

---

## 3. Repository Knowledge as System of Record

> If it isn't in the repo, it doesn't exist.

From the agent's perspective, anything it can't access in-context
doesn't exist. Knowledge in Google Docs, chat threads, or people's heads
is invisible. Only repository-local, versioned artifacts matter.

### Give agents a map, not a manual

A giant instruction file is harmful:

| Problem                                | Why                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Context is scarce                      | A large file crowds out the task, code, and relevant docs                          |
| Too much guidance becomes non-guidance | When everything is "important", nothing is                                         |
| It rots instantly                      | A monolithic manual becomes a graveyard of stale rules                             |
| Hard to verify                         | A single blob doesn't support mechanical checks (coverage, freshness, cross-links) |

**Solution**: treat AGENTS.md / CLAUDE.md as a **table of contents**
(~100 lines), with pointers to deeper sources of truth in `docs/`.

### Knowledge store layout

| Artifact type    | Location              | Purpose                                                           |
| ---------------- | --------------------- | ----------------------------------------------------------------- |
| Design docs      | `docs/design/`        | Catalogued and indexed, with verification status and core beliefs |
| Architecture     | `ARCHITECTURE.md`     | Top-level domain map and package layering                         |
| Quality grades   | `docs/QUALITY.md`     | Per-domain and per-layer quality tracking                         |
| Execution plans  | `docs/exec-plans/`    | Active, completed, and tech-debt plans with decision logs         |
| Conventions      | `docs/conventions/`   | Error handling, observability, testing, security                  |
| Module ownership | `src/<mod>/AGENTS.md` | Per-module agent guidance                                         |

### Progressive disclosure

Agents start with a small, stable entry point and are taught where to
look next, rather than being overwhelmed up front. CI linters and jobs
validate that the knowledge base is up to date, cross-linked, and
structured correctly. A recurring "doc-gardening" agent scans for stale
documentation and opens fix-up PRs.

---

## 4. Agent Legibility is the Goal

The codebase is optimised for **agent legibility**, not human stylistic
preference. The goal is for an agent to reason about the full business
domain directly from the repository itself.

- Favour dependencies and abstractions that can be fully internalised
  and reasoned about in-repo.
- Prefer "boring" technologies — they are easier for agents to model due
  to composability, API stability, and training-set representation.
- Sometimes it is cheaper to reimplement a subset of functionality than
  to work around opaque upstream behaviour from public libraries.
- Giving the agent more context means organising and exposing the right
  information so it can reason over it, rather than overwhelming it with
  ad-hoc instructions.

---

## 5. Enforcing Architecture and Taste

Documentation alone doesn't keep a codebase coherent. **Enforce
invariants, not implementations** — let agents ship fast without
undermining the foundation.

### Rigid architectural model

- Each business domain is divided into a fixed set of layers with
  strictly validated dependency directions.
- Forward-only dependencies: Types -> Config -> Repo -> Service ->
  Runtime -> UI.
- Cross-cutting concerns enter through a single explicit interface
  (Providers). Everything else is disallowed and enforced mechanically.
- These constraints are enforced via custom linters and structural tests.

### Taste invariants

- Structured logging, naming conventions for schemas/types, file size
  limits, and platform-specific reliability requirements — all enforced
  by custom lint rules.
- Custom lint error messages inject remediation instructions into agent
  context, so the agent self-corrects.
- Be explicit about where constraints matter and where they do not.
  Enforce boundaries centrally, allow autonomy locally.
- The resulting code does not always match human stylistic preferences,
  and that's acceptable as long as it is correct, maintainable, and
  legible to future agent runs.

### Encoding taste into the system

- Review comments, refactoring PRs, and user-facing bugs are captured
  as documentation updates or encoded directly into tooling.
- When documentation falls short, promote the rule into code (lints,
  tests, structural checks).

---

## 6. Throughput Changes the Merge Philosophy

- Operate with minimal blocking merge gates. PRs are short-lived.
- Test flakes are addressed with follow-up runs rather than blocking
  progress indefinitely.
- In a system where agent throughput far exceeds human attention,
  corrections are cheap and waiting is expensive.

---

## 7. What "Agent-Generated" Means

Agents produce everything: product code, tests, CI configuration,
release tooling, internal developer tools, documentation, design
history, evaluation harnesses, review comments, repository management
scripts, and production dashboard definitions.

Humans remain in the loop but work at a different layer of abstraction:
prioritise work, translate user feedback into acceptance criteria, and
validate outcomes. When the agent struggles, it is a signal to identify
what is missing (tools, guardrails, documentation) and feed it back into
the repository.

---

## 8. Increasing Levels of Autonomy

As the development loop (testing, validation, review, feedback handling,
recovery) is encoded into the system, agents can end-to-end drive
features: validate state, reproduce bugs, implement fixes, record
evidence, open PRs, respond to feedback, detect build failures, escalate
when needed, and merge.

This depends heavily on repository structure and tooling investment.

---

## 9. Entropy and Garbage Collection

Agents replicate patterns that already exist — even suboptimal ones.
Over time this leads to drift.

**Counter-measures**:

- Encode "golden principles" (opinionated, mechanical rules) directly
  into the repository.
- Run recurring background tasks that scan for deviations, update
  quality grades, and open targeted refactoring PRs.
- Treat technical debt like a high-interest loan: pay it down
  continuously in small increments rather than letting it compound.
- Human taste is captured once, then enforced continuously on every line
  of code via lints and structural tests.

---

## 10. Key Takeaways for GreenClaw

1. **Knowledge store first** — document before you code; the repo is the
   system of record.
2. **Map, not manual** — keep CLAUDE.md short; deep knowledge lives in
   `docs/`.
3. **Enforce invariants mechanically** — architecture tests, custom
   linters, CI checks.
4. **Optimise for agent legibility** — boring tech, in-repo abstractions,
   observable systems.
5. **Progressive disclosure** — small entry point, clear pointers to
   deeper docs.
6. **Taste as code** — when a doc rule is repeatedly violated, promote it
   to a lint or test.
7. **Continuous garbage collection** — recurring quality sweeps prevent
   drift.
8. **Humans steer, agents execute** — invest in scaffolding, not in
   writing code by hand.
