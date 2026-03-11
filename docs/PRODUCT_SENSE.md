# GreenClaw — Product Sense

## The Problem

OpenClaw users typically spend $200+/month on LLM inference. Over 60% of that
cost comes from sending full conversation history to expensive frontier models
for trivial tasks — heartbeat checks, status pings, simple lookups, and
single-tool-call operations that don't need a $15/MTok model.

## The Solution

GreenClaw is a transparent inference proxy that sits between OpenClaw and
upstream LLM providers. It intercepts requests, classifies their complexity,
and routes them to the cheapest appropriate model:

| Task Type | Example                            | Model Cost          |
| --------- | ---------------------------------- | ------------------- |
| Heartbeat | Status ping, cron health check     | $0.075–0.15/MTok    |
| Simple    | Timezone lookup, single tool call  | $0.25–0.50/MTok     |
| Moderate  | Email triage, 2–3 tool chain       | $3–5/MTok           |
| Complex   | Multi-agent coordination, code gen | $15/MTok (original) |

## Target Users

OpenClaw operators who:

- Run always-on agent workflows with high request volumes
- See significant spend on trivial classification tasks
- Want cost reduction without changing their OpenClaw configuration
- Need zero-downtime deployment (just swap the base URL)

## Key Product Decisions

1. **Zero config change to OpenClaw**: Point OpenClaw at GreenClaw's URL instead
   of the provider's URL. Everything else stays the same.
2. **Provider-agnostic**: GreenClaw doesn't implement provider-specific logic.
   OpenClaw handles provider formats. GreenClaw only classifies and routes.
3. **Conservative classification**: When uncertain, classify UP to a more capable
   model. Quality is never degraded — only cost is optimized.
4. **Observable by default**: Every request produces a `RequestTrace` with cost
   comparison. Users can see exactly how much they're saving.

## What GreenClaw is NOT

- **Not a provider**: It doesn't host or serve models. It proxies to upstream providers.
- **Not an API gateway**: No rate limiting, auth management, or API key rotation.
- **Not a load balancer**: Routing is based on task complexity, not server health.
- **Not a response modifier**: Upstream responses pass through unchanged.
