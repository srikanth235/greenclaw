---
name: greenclaw-usage
description: Token usage analytics and budget alerting for the GreenClaw inference proxy. Query spending, set budget alerts, and track savings.
---

# GreenClaw Usage Analytics

You have access to the `greenclaw` CLI tool for querying token usage, cost analytics, and managing budget alerts. All commands output JSON.

## Available Commands

### Usage Queries

**Daily summary:**

```bash
greenclaw usage summary --period day
```

**Weekly or monthly summary:**

```bash
greenclaw usage summary --period week
greenclaw usage summary --period month
```

**Breakdown by model, tier, or provider:**

```bash
greenclaw usage breakdown --by model --period day
greenclaw usage breakdown --by tier --period week
greenclaw usage breakdown --by provider --period month
```

**Trends over time:**

```bash
greenclaw usage trends --period day --last 7
greenclaw usage trends --period week --last 4
```

### Budget Alerts

**List alert rules:**

```bash
greenclaw alerts list
```

**Set a daily cost budget:**

```bash
greenclaw alerts set --name "daily budget" --metric daily_cost --threshold 50 --unit usd --period day
```

**Set a weekly token limit:**

```bash
greenclaw alerts set --name "weekly tokens" --metric weekly_cost --threshold 100 --unit usd --period week
```

**Set a per-model cost cap:**

```bash
greenclaw alerts set --name "gpt-4 cap" --metric per_model_cost --threshold 30 --unit usd --period day --model gpt-4
```

**Check alerts now:**

```bash
greenclaw alerts check
```

**View alert history:**

```bash
greenclaw alerts history --last 10
```

**Remove an alert rule:**

```bash
greenclaw alerts remove <rule-id>
```

### Raw Traces

**Aggregated stats:**

```bash
greenclaw traces --stats
```

**Filter by tier or model:**

```bash
greenclaw traces --tier HEARTBEAT
greenclaw traces --model gpt-4o-mini
```

## How to Present Results

- Parse the JSON output and present it in a clear, readable format
- For summaries: show total tokens, cost, savings, and request count
- For breakdowns: show a table with group key, tokens, cost, savings
- For alerts: explain which rules triggered and current metric values
- Round dollar amounts to 2 decimal places
- Use natural language to explain savings (e.g., "You saved $8.91 today by routing 412 requests through cheaper models")

## Environment

The `greenclaw` CLI uses the `GREENCLAW_TELEMETRY_DB` environment variable for the SQLite database path (defaults to `data/telemetry.db`).
