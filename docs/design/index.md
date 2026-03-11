# GreenClaw — Design Index

All design knowledge lives here: principles, philosophy, and architecture
decisions (ADRs). Each document captures a rationale that agents should
understand before modifying related code.

## Documents

| Document                                                    | Status   | Summary                                                               |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| [001-philosophy](001-philosophy.md)                         | Verified | Transparent proxy, heuristics-first, pure pipeline, cost optimization |
| [002-core-beliefs](002-core-beliefs.md)                     | Verified | Agent-first operating principles — 9 non-negotiable beliefs           |
| [003-language-and-framework](003-language-and-framework.md) | Accepted | TypeScript + Hono + Node 22 + pnpm                                    |
| [004-routing-strategy](004-routing-strategy.md)             | Accepted | Four-tier routing (HEARTBEAT → SIMPLE → MODERATE → COMPLEX)           |
| [005-zod-as-source-of-truth](005-zod-as-source-of-truth.md) | Accepted | Zod schemas as single source of truth                                 |

## Verification Status

| Status   | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| Verified | Content matches current code behavior, reviewed within 30 days |
| Stale    | Content may not reflect current code, needs review             |
| Draft    | New document, not yet verified against implementation          |

When updating code that contradicts a design doc, update the doc in the same
PR. When reviewing design docs, update the "Last Verified" date.

## Adding a New Document

1. Assign the next sequential number: `docs/design/NNN-<slug>.md`
2. Add a row to the table above
3. Add a row to root `AGENTS.md` design table
