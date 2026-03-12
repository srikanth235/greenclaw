/**
 * CLI alerts subcommands.
 * @module @greenclaw/cli/commands/alerts
 */

import { loadConfig } from '@greenclaw/config';
import { createStore } from '@greenclaw/telemetry';
import { createUsageStore } from '@greenclaw/monitoring';
import { AlertMetricSchema, ThresholdUnitSchema, AlertPeriodSchema } from '@greenclaw/types';

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
 * Run the alerts subcommand.
 * @param args - CLI arguments after 'alerts'
 */
export function runAlertsCommand(args: string[]): void {
  const config = loadConfig();
  const telemetryStore = createStore(config.telemetryDbPath);
  const usageStore = createUsageStore(telemetryStore.getDb());
  const sub = args[0];

  try {
    if (sub === 'list') {
      const rules = usageStore.listRules();
      process.stdout.write(JSON.stringify(rules, null, 2) + '\n');
    } else if (sub === 'set') {
      const name = getArg(args, '--name');
      const metric = getArg(args, '--metric');
      const threshold = getArg(args, '--threshold');
      const unit = getArg(args, '--unit');
      const period = getArg(args, '--period');
      const model = getArg(args, '--model') ?? null;

      if (!name || !metric || !threshold || !unit || !period) {
        process.stderr.write(
          'Error: --name, --metric, --threshold, --unit, --period are required\n',
        );
        process.exitCode = 1;
        return;
      }

      const metricResult = AlertMetricSchema.safeParse(metric);
      if (!metricResult.success) {
        process.stderr.write(
          `Error: invalid --metric "${metric}". Must be one of: daily_tokens, daily_cost, weekly_cost, per_model_cost\n`,
        );
        process.exitCode = 1;
        return;
      }

      const unitResult = ThresholdUnitSchema.safeParse(unit);
      if (!unitResult.success) {
        process.stderr.write(`Error: invalid --unit "${unit}". Must be one of: tokens, usd\n`);
        process.exitCode = 1;
        return;
      }

      const periodResult = AlertPeriodSchema.safeParse(period);
      if (!periodResult.success) {
        process.stderr.write(
          `Error: invalid --period "${period}". Must be one of: day, week, month\n`,
        );
        process.exitCode = 1;
        return;
      }

      const thresholdNum = Number(threshold);
      if (Number.isNaN(thresholdNum) || thresholdNum < 0) {
        process.stderr.write(
          `Error: invalid --threshold "${threshold}". Must be a non-negative number\n`,
        );
        process.exitCode = 1;
        return;
      }

      const rule = {
        id: `rule-${Date.now().toString(36)}`,
        name,
        metric: metricResult.data,
        threshold_value: thresholdNum,
        threshold_unit: unitResult.data,
        period: periodResult.data,
        model_filter: model,
        enabled: true,
        created_at: new Date().toISOString(),
      };
      usageStore.setRule(rule);
      process.stdout.write(JSON.stringify({ created: rule }, null, 2) + '\n');
    } else if (sub === 'remove') {
      const id = args[1];
      if (!id) {
        process.stderr.write('Error: alert rule ID required\n');
        process.exitCode = 1;
        return;
      }
      const removed = usageStore.removeRule(id);
      process.stdout.write(JSON.stringify({ removed, id }) + '\n');
    } else if (sub === 'history') {
      const limit = Number(getArg(args, '--last') ?? '20');
      const events = usageStore.alertHistory(limit);
      process.stdout.write(JSON.stringify(events, null, 2) + '\n');
    } else if (sub === 'check') {
      const triggered = usageStore.checkAlerts();
      const rules = usageStore.listRules().filter((r) => r.enabled);
      process.stdout.write(
        JSON.stringify(
          {
            checked_rules: rules.length,
            triggered,
            passed: rules.length - triggered.length,
          },
          null,
          2,
        ) + '\n',
      );
    } else {
      process.stdout.write(
        JSON.stringify({
          usage: [
            'list',
            'set --name <n> --metric <m> --threshold <v> --unit tokens|usd --period day|week|month [--model <m>]',
            'remove <id>',
            'history [--last N]',
            'check',
          ],
        }) + '\n',
      );
    }
  } finally {
    telemetryStore.close();
  }
}
