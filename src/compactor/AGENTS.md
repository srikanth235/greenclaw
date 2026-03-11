# compactor/ — Agent Guidelines

## Ownership

This module compacts conversation context when it exceeds a token threshold.

### What it owns

- `compact(messages: ChatMessage[], tokenLimit: number): ChatMessage[]`
- Summarization strategy for old conversation turns
- Token counting via tiktoken

### What it must NOT do

- Import from router, api, or dashboard
- Make upstream LLM calls (compaction is local, not LLM-assisted)
- Mutate the input messages array — always return a new array
- Drop the system prompt or the most recent user message

### Key invariants

- Output token count must be ≤ tokenLimit
- System message is always preserved verbatim
- Most recent N messages are preserved intact (sliding window)
- Older messages are summarized or dropped, not silently truncated
- This is a **pure function** with no side effects

### Dependencies from types/

- `ChatMessage` — input and output message schema

### Dependencies from config/

- Token threshold values (passed as parameter, not imported directly)
