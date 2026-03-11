# GreenClaw

A transparent inference proxy purpose-built for OpenClaw. GreenClaw sits between OpenClaw and upstream LLM providers, reducing token costs by 60%+ through intelligent task classification, context compaction, and model routing — without requiring any changes to OpenClaw beyond a base URL swap.

## The Problem

As an OpenClaw user spending $200+/month on LLM inference, most of that cost comes from sending full conversation history to expensive models for trivial tasks like heartbeat checks and simple lookups. Change one line in your config and your costs drop by 60%+.

## How It Works

GreenClaw acts as a transparent proxy. OpenClaw already supports multiple providers and handles provider-specific API formats natively. GreenClaw doesn't re-implement any of that — it simply:

1. **Intercepts** requests from OpenClaw (any provider format)
2. **Classifies** the task complexity (HEARTBEAT / SIMPLE / MODERATE / COMPLEX)
3. **Compacts** conversation context if it exceeds a token budget
4. **Swaps** the model to a cheaper one appropriate for the task tier
5. **Forwards** the request as-is to the upstream provider

No provider-specific logic. No response format mapping. Just classification, compaction, routing, and forwarding.

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

## OpenClaw Configuration

Point OpenClaw at GreenClaw by updating `~/.openclaw/openclaw.json` to route
through the proxy. GreenClaw intercepts requests, optimises them, and forwards
to the original upstream provider.

## Development

```bash
pnpm dev          # Start with hot reload
pnpm build        # Compile TypeScript
pnpm start        # Run compiled output
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm typecheck    # Type check without emitting
pnpm lint         # Lint with zero warnings
pnpm format       # Format with Prettier
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system diagram and request lifecycle.

## License

MIT
