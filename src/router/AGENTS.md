# router/ — Agent Guidelines

## Ownership

This module maps a classified task tier to the cheapest appropriate upstream model.

### What it owns

- `route(tier: TaskTier, config: Config): ProviderModel`
- Tier-to-model mapping logic
- Provider selection when multiple providers serve the same tier

### What it must NOT do

- Import from api or dashboard
- Make network calls or perform I/O
- Contain classification logic (that belongs to classifier/)
- Hardcode model names — all mappings come from config

### Key invariants

- HEARTBEAT tier always routes to the cheapest available model
- Every tier must have at least one model mapped in config
- If the preferred provider is unavailable, fall back within the same tier
- Router is stateless — no request history or session tracking

### Dependencies from types/

- `TaskTier` — input enum
- `ProviderModel` — output type

### Dependencies from config/

- Provider registry and tier-to-model mapping
