# classifier/ — Agent Guidelines

## Ownership

This module classifies incoming chat completion requests into task tiers.

### What it owns

- `classify(messages: ChatMessage[], model: string): TaskTier`
- Heuristic rules for tier assignment:
  - HEARTBEAT: status checks, pings, cron patterns, "HEARTBEAT" keyword
  - SIMPLE: single tool calls, short factual questions
  - MODERATE: multi-step bounded tasks, email triage, 2-3 tool chains
  - COMPLEX: multi-agent coordination, open-ended generation, long chains

### What it must NOT do

- Import from compactor, router, api, or dashboard
- Make network calls or perform any I/O
- Have side effects — this is a **pure function**
- Call upstream LLMs to classify (heuristics only, no ML)

### Key invariants

- Must achieve ≥90% accuracy on `tests/fixtures/requests.json` (50 samples)
- The fixture test in `tests/classifier.fixture.test.ts` enforces this in CI
- Classification must be deterministic: same input → same output

### Dependencies from types/

- `ChatMessage` — input message schema
- `TaskTier` — output enum
