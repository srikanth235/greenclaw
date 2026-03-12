/**
 * CLI traces subcommand — migrated from scripts/query-traces.ts.
 * @module @greenclaw/cli/commands/traces
 */

import { loadConfig } from '@greenclaw/config';
import { createStore } from '@greenclaw/telemetry';

/**
 * Parse a named argument value.
 * @param args - Argument list
 * @param name - Flag name to find
 * @returns The value after the flag, or undefined
 */
function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

/**
 * Check if a flag is present.
 * @param args - Argument list
 * @param name - Flag name to check
 * @returns True if the flag exists
 */
function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

/**
 * Run the traces subcommand.
 * @param args - CLI arguments after 'traces'
 */
export function runTracesCommand(args: string[]): void {
  const config = loadConfig();
  const store = createStore(config.telemetryDbPath);

  try {
    if (hasFlag(args, '--stats')) {
      const stats = store.getStats();
      process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
    } else if (getArg(args, '--tier')) {
      const results = store.queryByTier(getArg(args, '--tier')!);
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else if (getArg(args, '--model')) {
      const results = store.queryByModel(getArg(args, '--model')!);
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else if (getArg(args, '--slow')) {
      const threshold = Number(getArg(args, '--slow'));
      const results = store.querySlowRequests(threshold);
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else if (getArg(args, '--since')) {
      const from = getArg(args, '--since')!;
      const until = getArg(args, '--until') ?? new Date().toISOString();
      const results = store.queryByTimeRange(from, until);
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
      process.stdout.write(
        JSON.stringify({
          usage: [
            '--stats             Aggregated statistics',
            '--tier <TIER>       Filter by task tier',
            '--model <MODEL>     Filter by routed model',
            '--slow <MS>         Traces above latency threshold',
            '--since <ISO>       Traces after timestamp (--until <ISO> optional)',
          ],
        }) + '\n',
      );
    }
  } finally {
    store.close();
  }
}
