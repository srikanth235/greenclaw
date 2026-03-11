# ADR-002: Four-Tier Model Routing Strategy

## Status

Accepted

## Context

OpenClaw sends all requests to a single model (typically Claude Opus at $15/MTok
input). Many of these requests are trivial — heartbeat checks, simple lookups,
status pings — and don't need a frontier model. GreenClaw must classify requests
by complexity and swap the model field to a cheaper alternative before forwarding
the request to the upstream provider.

GreenClaw is a transparent proxy — it does not implement provider-specific API
logic. OpenClaw already handles provider formats natively. GreenClaw only
inspects the request to classify it and swap the model, then forwards the
request as-is.

## Decision

### Four-Tier Classification

| Tier      | Description                                                     | Target Models             | Approx. Cost     |
| --------- | --------------------------------------------------------------- | ------------------------- | ---------------- |
| HEARTBEAT | Status checks, pings, cron health checks                        | Gemini Flash, GPT-4o-mini | $0.075–0.15/MTok |
| SIMPLE    | Single tool calls, factual questions, timezone conversions      | Claude Haiku, GPT-4o-mini | $0.25–0.50/MTok  |
| MODERATE  | Email triage, multi-step bounded tasks, 2-3 tool chains         | Claude Sonnet, GPT-4o     | $3–5/MTok        |
| COMPLEX   | Multi-agent coordination, code generation, research + synthesis | Claude Opus, GPT-4 Turbo  | $15/MTok         |

Note: HEARTBEAT is a special case of SIMPLE, force-downgraded to the absolute
cheapest model regardless of the request content.

### Classification Signals

The classifier uses these heuristics (no ML model):

1. **Keyword detection**: "HEARTBEAT", "status", "ping", "health" in messages
2. **Message count**: Single-turn vs. multi-turn conversations
3. **Message length**: Total token count across all messages
4. **Tool call count**: Number of `tool_calls` in assistant messages
5. **Tool call complexity**: Single lookup vs. chained operations
6. **Model name in request**: If the request explicitly names a model, respect it
7. **System prompt patterns**: Cron-style scheduling language, agent heartbeat patterns

### Why Heuristics First

- **Speed**: Heuristic classification adds <1ms per request; an ML classifier
  would add 10-50ms
- **Transparency**: Rules are debuggable; ML classifiers are black boxes
- **No training data needed**: We can ship day one without labeled datasets
- **Iterability**: Rules can be tuned per-customer without retraining
- **Fallback safety**: When uncertain, classify UP (more capable model) to
  avoid quality degradation

ML classification may be added later as an enhancement once we have enough
RequestTrace data to train on.

### Routing Mechanism

The router swaps the model field in the incoming request body before the api/
module forwards it upstream. This is the only mutation GreenClaw makes to the
request. The upstream provider URL and all other request fields remain unchanged.

## Consequences

- The classifier is a pure function with no dependencies on external services
- Classification accuracy is validated by a fixture test (≥90% on 50 samples)
- Tier-to-model mapping is configured in config/, not hardcoded in classifier/
- Router selects the cheapest available model for a given tier
- Misclassification toward a higher tier is acceptable; toward a lower tier is not
