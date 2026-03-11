# ADR-001: Language and Framework Selection

## Status

Accepted

## Context

GreenClaw is an OpenAI-compatible inference proxy that sits on the hot path between
OpenClaw and upstream LLM providers. Every proxied request passes through it, so
runtime overhead must be minimal. The tech stack must support:

- Streaming SSE passthrough
- Strong typing for API contracts
- Fast startup time
- Minimal dependency footprint
- Developer productivity for a small team

## Options Considered

### 1. TypeScript + Hono + pnpm (selected)

**Pros:**

- Hono has near-zero overhead on the hot path (~2μs per request routing)
- Excellent TypeScript types out of the box
- Native fetch in Node 22 — no external HTTP client needed
- Zod integration is idiomatic and well-supported
- pnpm is fast, disk-efficient, and supports strict dependency resolution
- tsx provides fast dev-mode reloading

**Cons:**

- Single-threaded by default (mitigated by async I/O and proxy workload being I/O-bound)
- V8 memory overhead vs. Go

### 2. Python + FastAPI

**Pros:**

- FastAPI has excellent OpenAPI doc generation
- Strong async support via asyncio

**Cons:**

- Slower runtime performance (GIL, interpreter overhead)
- Type checking is optional and weaker than TypeScript strict mode
- Streaming passthrough is more complex (ASGI vs. SSE)
- Package management fragmentation (pip, poetry, uv, conda)

### 3. Go + chi

**Pros:**

- Excellent raw performance and low memory footprint
- Built-in concurrency via goroutines

**Cons:**

- More verbose for JSON schema validation (no Zod equivalent)
- Slower iteration speed for a proxy with evolving API contracts
- Weaker ecosystem for OpenAI-compatible type definitions

### 4. Bun runtime (TypeScript)

**Pros:**

- Faster startup and execution than Node.js
- Built-in bundler and test runner

**Cons:**

- Less mature ecosystem — edge cases in compatibility
- tiktoken WASM may have compatibility issues
- Smaller community for production troubleshooting

## Decision

**TypeScript + Hono + Node.js 22 + pnpm**

GreenClaw is a proxy, not a compute-heavy application. The workload is I/O-bound
(receiving requests, forwarding to upstream, streaming back). Hono's minimal
overhead on routing and middleware makes it ideal. TypeScript strict mode with Zod
schemas gives us strong contracts at the API boundary. Node 22's native fetch
eliminates the need for axios/got/undici.

## Consequences

- All code is TypeScript with strict mode enabled
- Hono is the only HTTP framework dependency
- pnpm is the package manager; lockfile is committed
- No bundler needed — tsc compiles directly for Node.js
- CI runs on Node 22
