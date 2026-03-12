/**
 * CLI usage subcommands.
 * @module @greenclaw/cli/commands/usage
 */

import { loadConfig } from '@greenclaw/config';
import { createStore } from '@greenclaw/telemetry';
import { createUsageStore } from '@greenclaw/monitoring';

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
 * Run the usage subcommand.
 * @param args - CLI arguments after 'usage'
 */
export function runUsageCommand(args: string[]): void {
  const config = loadConfig();
  const telemetryStore = createStore(config.telemetryDbPath);
  const usageStore = createUsageStore(telemetryStore.getDb());
  const sub = args[0];

  try {
    if (sub === 'summary') {
      const period = getArg(args, '--period') ?? 'day';
      const result = usageStore.summary(period);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (sub === 'breakdown') {
      const by = getArg(args, '--by') as 'model' | 'tier' | 'provider' | undefined;
      if (!by) {
        process.stderr.write('Error: --by is required (model|tier|provider)\n');
        process.exitCode = 1;
        return;
      }
      const period = getArg(args, '--period') ?? 'day';
      const result = usageStore.breakdown(by, period);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else if (sub === 'trends') {
      const period = (getArg(args, '--period') ?? 'day') as 'day' | 'week';
      const last = Number(getArg(args, '--last') ?? '7');
      const result = usageStore.trends(period, last);
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write(
        JSON.stringify({
          usage: [
            'summary [--period day|week|month]',
            'breakdown --by model|tier|provider [--period day|week|month]',
            'trends --period day|week [--last N]',
          ],
        }) + '\n',
      );
    }
  } finally {
    telemetryStore.close();
  }
}
