# config/ — Agent Guidelines

## Ownership

Layer 1. Single source of truth for all GreenClaw runtime configuration.

### What it owns

- Environment variable loading and validation via Zod
- Config-owned env surface mirrored in `.env.example`
- Upstream base URL and tiered provider/model defaults
- Port (`GREENCLAW_PORT`), log level, and telemetry DB path

### What it must NOT do

- Import from upper-layer packages (optimization, monitoring, cli, api, dashboard)
- Make network calls or perform I/O beyond reading env vars
- Contain business logic

### Key invariants

- Config schema is Zod; the `Config` type is `z.infer<>` derived
- All env vars have sensible defaults or fail fast with clear error messages
- `loadConfig()` reparses the provided env bag on each call
- Callers should treat the returned config object as immutable runtime state

### Dependencies

- `@greenclaw/types` (Layer 0)
