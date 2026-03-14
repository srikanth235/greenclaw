---
active:
  - { id: TD-002, module: compactor, priority: Medium, status: Open }
  - { id: TD-004, module: dashboard, priority: Low, status: Open }
resolved:
  - { id: TD-001, resolved: "2026-03-13" }
  - { id: TD-003, resolved: "2026-03-13" }
  - { id: TD-005, resolved: "2026-03-12" }
  - { id: TD-006, resolved: "2026-03-12" }
---
# GreenClaw — Technical Debt Tracker

Known technical debt, tracked with owner module, priority, and status.
Address high-priority items before adding new features.

## Active Debt

| ID     | Debt                                  | Module     | Priority | Status | Notes                                                |
| ------ | ------------------------------------- | ---------- | -------- | ------ | ---------------------------------------------------- |
| TD-002 | tiktoken WASM initialization overhead | compactor/ | Medium   | Open   | Lazy-load and cache the encoder instance             |
| TD-004 | Dashboard is stub-only                | dashboard/ | Low      | Open   | Deferred to PLAN-005                                 |

## Resolved Debt

| ID | Debt | Resolved | Resolution |
| -- | ---- | -------- | ---------- |
| TD-001 | Architecture test is `it.skip` | 2026-03-13 | Unskipped layer-dependency enforcement during PLAN-009 harness activation. |
| TD-003 | No integration test harness | 2026-03-13 | Added live proxy contract coverage with mock upstream passthrough, SSE parity, and health checks in PLAN-009. |
| TD-005 | No telemetry persistence | 2026-03-12 | Added SQLite-backed `request_traces` persistence in PLAN-006. |
| TD-006 | No local observability stack | 2026-03-12 | Added Pino structured logging plus SQLite telemetry storage in PLAN-006. |

## Adding New Debt

When you discover technical debt during development:

1. Add a row to the Active Debt table with the next TD-NNN ID
2. Set priority: **High** (blocks other work), **Medium** (should fix soon),
   **Low** (nice to have)
3. Include the owning module and a brief description

When resolving debt:

1. Move the row from Active to Resolved
2. Add the resolution date and a brief description of the fix
