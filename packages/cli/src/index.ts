#!/usr/bin/env node

/**
 * GreenClaw CLI — usage analytics, alerting, and trace queries.
 *
 * Usage:
 *   greenclaw usage summary [--period day|week|month]
 *   greenclaw usage breakdown --by model|tier|provider [--period day|week|month]
 *   greenclaw usage trends --period day|week [--last N]
 *   greenclaw alerts list
 *   greenclaw alerts set --name <n> --metric <m> --threshold <v> --unit tokens|usd --period day|week|month [--model <m>]
 *   greenclaw alerts remove <id>
 *   greenclaw alerts history [--last N]
 *   greenclaw alerts check
 *   greenclaw traces --stats | --tier <T> | --model <M> | --slow <ms> | --since <ISO> [--until <ISO>]
 *
 * Environment:
 *   GREENCLAW_TELEMETRY_DB — path to SQLite DB (default: data/telemetry.db)
 *
 * All output is JSON to stdout for agent/skill consumption.
 * @module @greenclaw/cli
 */

import { runAlertsCommand } from './commands/alerts.js';
import { runTracesCommand } from './commands/traces.js';
import { runUsageCommand } from './commands/usage.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'usage') {
  runUsageCommand(args.slice(1));
} else if (command === 'alerts') {
  runAlertsCommand(args.slice(1));
} else if (command === 'traces') {
  runTracesCommand(args.slice(1));
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        commands: {
          'usage summary': 'Aggregated usage for a period',
          'usage breakdown': 'Usage grouped by model, tier, or provider',
          'usage trends': 'Time-series usage data',
          'alerts list': 'Show configured alert rules',
          'alerts set': 'Create or update an alert rule',
          'alerts remove': 'Delete an alert rule',
          'alerts history': 'Show triggered alert events',
          'alerts check': 'Evaluate all rules now',
          traces: 'Query raw request traces',
        },
      },
      null,
      2,
    )}\n`,
  );
}
