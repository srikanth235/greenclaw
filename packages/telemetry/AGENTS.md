# telemetry/ — Agent Guidelines

## Ownership

Layer 2. Structured logging (Pino) and telemetry persistence (SQLite).

### What it owns

- Pino logger factory (`createLogger`)
- SQLite telemetry store (`createStore`)
- Trace insertion and query functions
- DB schema creation and graceful degradation (no-op fallback)

### What it must NOT do

- Import from classifier, compactor, router, api, or dashboard
- Contain business logic (classification, routing, compaction)
- Log PII or API keys (see `docs/conventions/security.md`)
- Crash the proxy if DB init fails — fall back to no-op mode

### Key invariants

1. SQLite operations are synchronous (better-sqlite3 is sync by design)
2. If DB init fails, emit a warn-level JSON line to stderr, return a no-op store
3. Logger uses `messageKey: 'message'`, custom `timestamp` key, strips `pid`/`hostname`
4. Timestamps are normalized to UTC ISO-8601 on insert and query
5. No PII in log output or stored traces
6. DB file location is configurable via `GREENCLAW_TELEMETRY_DB` env var
7. Shared `RequestTrace` types come from `@greenclaw/types`, not local duplicates
8. SQLite schema and indexes must stay in parity with `docs/conventions/observability.md`

### Dependencies

- `types/` (Layer 0) — will use `RequestTrace` schema when implemented
- `config/` (Layer 1) — DB path, log level
