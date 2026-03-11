# GreenClaw — Design Philosophy

## Transparent Proxy Principle

GreenClaw is a transparent proxy. It does not implement provider-specific API
logic. OpenClaw already handles provider formats natively. GreenClaw only:

1. **Inspects** the request to classify task complexity
2. **Swaps** the model field to a cheaper alternative
3. **Forwards** the request as-is to the upstream provider

Upstream responses are forwarded unchanged — streaming SSE chunks pass through
byte-for-byte, non-streaming JSON responses are returned verbatim. This is the
single most important design constraint: **never modify upstream responses**.

## Heuristics-First Classification

Classification uses deterministic heuristic rules, not ML models
([004-routing-strategy](004-routing-strategy.md)):

- **Speed**: Heuristic classification adds <1ms per request; ML would add 10–50ms
- **Transparency**: Rules are debuggable; ML classifiers are black boxes
- **No training data**: Ships day one without labeled datasets
- **Iterability**: Rules can be tuned per-customer without retraining
- **Safety**: When uncertain, classify UP (more capable model) to avoid
  quality degradation. Misclassifying DOWN is never acceptable.

ML classification may be added later once sufficient `RequestTrace` data exists.

## Pure Pipeline

The request pipeline (classify → compact → route) is composed of pure functions:

- **classifier/** — deterministic: same input always produces same output
- **compactor/** — never mutates input, always returns a new array
- **router/** — stateless, no request history or session tracking

Side effects (network I/O, database writes, logging) happen only in **api/**,
which orchestrates the pipeline. This makes the pipeline testable, debuggable,
and safe to refactor.

## Cost Optimization as Primary Metric

Every design decision is evaluated against cost savings:

- HEARTBEAT tier routes to the cheapest model ($0.075/MTok vs $15/MTok)
- Context compaction reduces token counts before forwarding
- The dashboard tracks `savings_usd` per request
- The classifier fixture test enforces accuracy, not just correctness

The target is 60%+ cost reduction for typical OpenClaw workloads.

## Zod as Source of Truth

All external data shapes are Zod schemas. TypeScript types are derived via
`z.infer<>`, never declared independently
([005-zod-as-source-of-truth](005-zod-as-source-of-truth.md)). This gives us:

- Runtime validation at API boundaries via `.parse()` / `.safeParse()`
- A single definition for both the schema and the type
- Structured validation error messages out of the box
