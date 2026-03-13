# config/ — Agent Guidelines

## Ownership

Layer 1. Single source of truth for all GreenClaw runtime configuration.

### What it owns

- Environment variable loading and validation via Zod
- Provider registry (upstream LLM endpoints and API keys)
- Model-to-tier mapping (which models serve which tiers)
- Token thresholds (when to trigger compaction)
- Port (`GREENCLAW_PORT`), log level, and other operational settings

### What it must NOT do

- Import from upper-layer packages (optimization, monitoring, cli, api, dashboard)
- Make network calls or perform I/O beyond reading env vars
- Contain business logic

### Key invariants

- Config schema is Zod; the `Config` type is `z.infer<>` derived
- All env vars have sensible defaults or fail fast with clear error messages
- Config is loaded once at startup and treated as immutable

### Dependencies

- `@greenclaw/types` (Layer 0)
