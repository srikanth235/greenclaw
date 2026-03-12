#!/usr/bin/env tsx
/**
 * CLI tool for querying the GreenClaw telemetry store.
 *
 * Usage:
 *   pnpm tsx scripts/query-traces.ts --stats
 *   pnpm tsx scripts/query-traces.ts --tier HEARTBEAT
 *   pnpm tsx scripts/query-traces.ts --model gpt-4o-mini
 *   pnpm tsx scripts/query-traces.ts --slow 1000
 *   pnpm tsx scripts/query-traces.ts --since 2026-03-12T00:00:00Z
 *   pnpm tsx scripts/query-traces.ts --since 2026-03-12T00:00:00Z --until 2026-03-13T00:00:00Z
 *
 * Environment:
 *   GREENCLAW_TELEMETRY_DB — path to SQLite DB (default: data/telemetry.db)
 *
 * Output is always JSON to stdout for agent consumption.
 */

import { createStore } from '../src/telemetry/store.js';

const dbPath = process.env['GREENCLAW_TELEMETRY_DB'] ?? 'data/telemetry.db';
const store = createStore(dbPath);
const args = process.argv.slice(2);

/**
 * Parse a named argument from the CLI args.
 * @param name - The argument name (e.g., '--tier')
 * @returns The value after the flag, or undefined
 */
function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

/**
 * Check if a flag is present in the CLI args.
 * @param name - The flag name (e.g., '--stats')
 * @returns True if the flag is present
 */
function hasFlag(name: string): boolean {
  return args.includes(name);
}

try {
  if (hasFlag('--stats')) {
    const stats = store.getStats();
    process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
  } else if (getArg('--tier')) {
    const results = store.queryByTier(getArg('--tier')!);
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else if (getArg('--model')) {
    const results = store.queryByModel(getArg('--model')!);
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else if (getArg('--slow')) {
    const threshold = Number(getArg('--slow'));
    const results = store.querySlowRequests(threshold);
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else if (getArg('--since')) {
    const from = getArg('--since')!;
    const until = getArg('--until') ?? new Date().toISOString();
    const results = store.queryByTimeRange(from, until);
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else {
    process.stdout.write(
      JSON.stringify({
        usage: [
          '--stats             Aggregated statistics',
          '--tier <TIER>       Filter by task tier (HEARTBEAT, SIMPLE, MODERATE, COMPLEX)',
          '--model <MODEL>     Filter by routed model name',
          '--slow <MS>         Traces with total latency above threshold',
          '--since <ISO>       Traces after timestamp (--until <ISO> optional)',
        ],
      }) + '\n',
    );
  }
} finally {
  store.close();
}
