# GreenClaw

A transparent inference proxy purpose-built for OpenClaw. GreenClaw sits between OpenClaw and upstream LLM providers, reducing token costs by 60%+ through intelligent task classification, context compaction, and model routing — without requiring any changes to OpenClaw beyond a base URL swap.

## The Problem

As an OpenClaw user spending $200+/month on LLM inference, most of that cost comes from sending full conversation history to expensive frontier models ($15/MTok) for trivial tasks like heartbeat checks and simple lookups. Change one line in your config and your costs drop by 60%+.

## How It Works

GreenClaw acts as a transparent proxy. OpenClaw already supports multiple providers and handles provider-specific API formats natively. GreenClaw doesn't re-implement any of that — it simply:

1. **Intercepts** requests from OpenClaw (any provider format)
2. **Classifies** the task complexity (HEARTBEAT / SIMPLE / MODERATE / COMPLEX)
3. **Compacts** conversation context if it exceeds a token budget
4. **Routes** the model to a cheaper one appropriate for the task tier
5. **Forwards** the request as-is to the upstream provider
6. **Observes** cost, token consumption, tier distribution, and savings

No provider-specific logic. No response format mapping. Just classification, compaction, routing, and forwarding.

### Four-Tier Routing

| Tier      | Examples                       | Model Cost       |
| --------- | ------------------------------ | ---------------- |
| HEARTBEAT | Pings, health checks, cron     | $0.075–0.15/MTok |
| SIMPLE    | Single tool, factual questions | $0.25–0.50/MTok  |
| MODERATE  | Email triage, 2–3 tool chains  | $3–5/MTok        |
| COMPLEX   | Code gen, multi-agent research | $15/MTok (orig)  |

Classification uses deterministic heuristic rules (<1ms overhead), not ML. When uncertain, it misclassifies UP, never down.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your upstream API keys

# Start the proxy
pnpm dev
```

GreenClaw starts on `http://localhost:9090`.

### OpenClaw Configuration

Point OpenClaw at GreenClaw by updating `~/.openclaw/openclaw.json` to route through the proxy. GreenClaw intercepts requests, optimises them, and forwards to the original upstream provider.

## Monorepo Structure

GreenClaw is organised as a **pnpm workspace monorepo** with strict layer-based dependencies. Each layer may only import from the same or lower layers.

```
packages/
├── types/          # Layer 0 — Zod schemas & derived TypeScript types
├── config/         # Layer 1 — Environment variable loading & validation
├── telemetry/      # Layer 2 — Structured logging (Pino) + SQLite persistence
├── optimization/   # Layer 3 — Pure task classification, compaction, routing
├── monitoring/     # Layer 3 — Usage analytics & budget alerting
├── cli/            # Layer 4 — `greenclaw` CLI entry point
├── api/            # Layer 4 — Hono HTTP proxy server
└── dashboard/      # Layer 5 — Read-only cost telemetry dashboard
```

Layer dependency rules are enforced by `tests/architecture.test.ts`.

## CLI

The `greenclaw` CLI outputs JSON for all commands.

### Usage Analytics

```bash
greenclaw usage summary [--period day|week|month]
greenclaw usage breakdown --by model|tier|provider [--period ...]
greenclaw usage trends --period day|week [--last N]
```

### Budget Alerts

```bash
greenclaw alerts list
greenclaw alerts set --name <n> --metric <m> --threshold <v> --unit tokens|usd --period day|week|month [--model <m>]
greenclaw alerts remove <id>
greenclaw alerts history [--last N]
greenclaw alerts check
```

Supported metrics: `daily_tokens`, `daily_cost`, `weekly_cost`, `per_model_cost`.

### Trace Inspection

```bash
greenclaw traces --stats
greenclaw traces --tier <TIER>
greenclaw traces --model <MODEL>
greenclaw traces --slow <ms>
greenclaw traces --since <ISO> [--until <ISO>]
```

## Telemetry

GreenClaw records a `RequestTrace` for every proxied request into a local SQLite database. Each trace captures: original/routed model, task tier, token counts, cost (original vs. routed + savings), latency breakdown, and upstream status. No message content or API keys are stored.

Logging uses Pino with structured JSON output to stdout. If SQLite initialisation fails, telemetry gracefully degrades to a no-op store — the proxy continues serving.

## Development

```bash
pnpm build          # Compile all packages (tsc)
pnpm typecheck      # Type check without emitting
pnpm test           # Run tests (vitest)
pnpm test:watch     # Run tests in watch mode
pnpm lint           # Lint with zero warnings (eslint)
pnpm format         # Format with Prettier
```

### Tech Stack

- **Runtime**: Node.js >= 22
- **Language**: TypeScript (ES2022, strict mode)
- **HTTP**: Hono
- **Package Manager**: pnpm (workspace monorepo)
- **Testing**: Vitest
- **Logging**: Pino (structured JSON)
- **Storage**: better-sqlite3

### Testing

Tests are organised into categories:

- **Harness tests** — Structural invariants: architecture layers, consistency checks, file limits, module boundaries, skip hygiene, knowledge gate
- **Contract tests** — API response shape validation (golden tests)
- **Fixture tests** — Classifier accuracy benchmarks (50 samples, >=90% threshold)
- **Unit tests** — Per-package behaviour regression (`packages/*/tests/`)

### Key Design Principles

- **Transparent proxy** — requests and responses pass through unchanged; streaming SSE chunks forwarded byte-for-byte
- **Pure pipeline** — classifier, compactor, and router are deterministic pure functions with no side effects
- **Zod as source of truth** — all external data shapes are Zod schemas; TypeScript types derived via `z.infer<>`
- **Heuristic-first** — classification uses deterministic rules, not ML; <1ms overhead, debuggable, rule-tunable
- **Graceful degradation** — telemetry failure never blocks the proxy
- **Cost as primary metric** — every design decision evaluated against the 60%+ cost reduction target

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system diagram and request lifecycle.

## Documentation

| Document                                       | Topic                                             |
| ---------------------------------------------- | ------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)             | System diagram, dependency layers, lifecycle      |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Change lifecycle, commit workflow, conventions    |
| [docs/PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | Problem, solution, target users, non-goals        |
| [docs/QUALITY.md](docs/QUALITY.md)             | Quality grade per module                          |
| [docs/design/](docs/design/index.md)           | Architecture Decision Records (ADRs)              |
| [docs/conventions/](docs/conventions/)         | Errors, observability, testing, security, commits |
| [docs/exec-plans/](docs/PLANS.md)              | Active and completed execution plans              |

## License

MIT
