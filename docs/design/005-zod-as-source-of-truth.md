# ADR-003: Zod Schemas as Single Source of Truth

## Status

Accepted

## Context

GreenClaw processes requests at its proxy boundary, forwards them to upstream
providers, and emits telemetry traces. All of these data shapes need type safety.
There are two common approaches:

1. Define TypeScript interfaces first, then add runtime validation separately
2. Define Zod schemas first, derive TypeScript types via `z.infer<>`

## Decision

**Zod schemas are the single source of truth for all external data shapes.**

TypeScript types are always derived from Zod schemas using `z.infer<>` and are
never declared independently. This applies to:

- `RequestTrace` — telemetry records
- `Config` — runtime configuration
- `TaskTier` — classification enum
- `GreenClawError` — proxy-level error responses

### Example Pattern

```typescript
import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().nullable(),
  tool_calls: z.array(ToolCallSchema).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
```

### Why Not Interfaces First

- **Runtime validation**: TypeScript types are erased at runtime. Zod schemas
  provide `.parse()` and `.safeParse()` for validating untrusted input at the
  API boundary.
- **Single definition**: With interfaces-first, you end up maintaining both the
  interface and a separate validation layer (e.g., class-validator, ajv). With
  Zod-first, the schema IS the type.
- **Schema evolution**: Adding a field to the Zod schema automatically updates
  the TypeScript type. No sync issues.
- **Error messages**: Zod produces structured, human-readable validation errors
  out of the box.

## Consequences

### For the classifier module

- Classifier receives `ChatMessage[]` (Zod-derived type)
- Input is already validated by the api layer before reaching the classifier
- Classifier does not need to re-validate; it trusts the types

### For all modules

- No `interface` or `type` declarations for external data shapes outside of
  `src/types/`
- Internal-only types (e.g., function parameters, local state) may use plain
  TypeScript types
- All schema exports include both the Zod schema object and the inferred type
- ESLint rules prevent `any` usage, reinforcing type discipline
