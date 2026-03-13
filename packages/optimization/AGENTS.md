# optimization/ — Agent Guidelines

## Ownership

Layer 3. Task classification, context compaction, and model routing.

### What it owns

- **classifier/**: `classify(messages, model) → TaskTier` — heuristic rules
- **compactor/**: `compact(messages, tokenLimit) → CompactResult` — context reduction with applied flag
- **router/**: `route(tier, config, requestedModel) → ProviderModel` — tier-to-model mapping; provider derived from classified tier

### What it must NOT do

- Import from monitoring, cli, api, or dashboard
- Make network calls or perform any I/O
- Have side effects — all functions are **pure**
- Call upstream LLMs (heuristics only, no ML)

### Key invariants

- All functions are deterministic: same input → same output
- No timers, Math.random, Date.now, or fetch
- Compactor is currently a pass-through and preserves every input message
- Router never hardcodes model names — all mappings come from config
- Classifier biases upward on uncertainty by defaulting unmatched requests to
  `MODERATE`
- HEARTBEAT signals force HEARTBEAT classification; auto-routed requests then
  use the configured cheapest HEARTBEAT model

### Dependencies

- `@greenclaw/types` (Layer 0) — TaskTier, ChatMessage, ProviderModel
- `@greenclaw/config` (Layer 1) — model-to-tier mapping, token thresholds
