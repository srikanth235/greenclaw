# dashboard/ — Agent Guidelines

## Ownership

Layer 5. Dashboard status surface while the read-only UI is deferred.

### What it owns

- `getDashboardStatus()` placeholder export
- The explicit deferred-status contract for dashboard work (`TD-004`)

### What it must NOT do

- Import from lower packages until the UI work starts
- Expose routes or write APIs before the dashboard plan is active
- Block or slow down the main proxy hot path

### Key invariants

- Dashboard is non-critical — proxy functions without it
- `getDashboardStatus()` returns `implemented: false`
- The status reason points to `TD-004`
- Built last — stub only until the telemetry-backed UI work starts

### Dependencies

None yet. This package is currently a stub.
