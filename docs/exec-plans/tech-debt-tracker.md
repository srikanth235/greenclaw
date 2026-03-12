# GreenClaw — Technical Debt Tracker

Known technical debt, tracked with owner module, priority, and status.
Address high-priority items before adding new features.

## Active Debt

| ID     | Debt                                  | Module     | Priority | Status | Notes                                                |
| ------ | ------------------------------------- | ---------- | -------- | ------ | ---------------------------------------------------- |
| TD-001 | Architecture test is `it.skip`        | tests/     | High     | Open   | Unskip once stubs have real imports to validate      |
| TD-002 | tiktoken WASM initialization overhead | compactor/ | Medium   | Open   | Lazy-load and cache the encoder instance             |
| TD-003 | No integration test harness           | tests/     | Medium   | Open   | Need end-to-end proxy test with mock upstream        |
| TD-004 | Dashboard is stub-only                | dashboard/ | Low      | Open   | Deferred to PLAN-005                                 |
| TD-005 | No telemetry persistence              | telemetry/ | High     | In Progress | PLAN-006: SQLite store for RequestTrace                |
| TD-006 | No local observability stack          | telemetry/ | Medium   | In Progress | PLAN-006: Pino + SQLite, no Docker — see harness-engineering.md |

## Resolved Debt

| ID         | Debt | Resolved | Resolution |
| ---------- | ---- | -------- | ---------- |
| (none yet) |      |          |            |

## Adding New Debt

When you discover technical debt during development:

1. Add a row to the Active Debt table with the next TD-NNN ID
2. Set priority: **High** (blocks other work), **Medium** (should fix soon),
   **Low** (nice to have)
3. Include the owning module and a brief description

When resolving debt:

1. Move the row from Active to Resolved
2. Add the resolution date and a brief description of the fix
