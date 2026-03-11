# config/ — Agent Guidelines

## Ownership

This module is the single source of truth for all GreenClaw runtime configuration.

### What it owns

- Environment variable loading and validation via Zod
- Provider registry (upstream LLM endpoints and API keys)
- Model-to-tier mapping (which models serve which tiers)
- Token thresholds (when to trigger compaction)
- Port, log level, and other operational settings

### What it must NOT do

- Import from classifier, compactor, router, api, or dashboard
- Make network calls or perform I/O beyond reading env vars
- Contain business logic (classification, routing, compaction)

### Key invariants

- Config schema is defined in Zod; the `Config` type is `z.infer<>` derived
- All env vars have sensible defaults or fail fast with clear error messages
- Config is loaded once at startup and treated as immutable thereafter

### Dependencies from types/

- `TaskTier` — used in model-to-tier mapping
- `ProviderModel` — used in provider registry
