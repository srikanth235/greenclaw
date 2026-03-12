import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runAlertsCommand } from '../src/commands/alerts.js';

let tempDir = '';
let stdoutChunks: string[] = [];
let stderrChunks: string[] = [];

/**
 * Create an isolated telemetry DB path for a test.
 * @returns Absolute SQLite path
 */
function createDbPath(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'greenclaw-cli-alerts-'));
  return path.join(tempDir, 'telemetry.db');
}

beforeEach(() => {
  stdoutChunks = [];
  stderrChunks = [];
  process.exitCode = undefined;
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderrChunks.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env['GREENCLAW_TELEMETRY_DB'];
  process.exitCode = undefined;
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  }
});

describe('runAlertsCommand', () => {
  it('rejects per-model cost alerts without a model filter', () => {
    process.env['GREENCLAW_TELEMETRY_DB'] = createDbPath();

    runAlertsCommand([
      'set',
      '--name',
      'cap',
      '--metric',
      'per_model_cost',
      '--threshold',
      '5',
      '--unit',
      'usd',
      '--period',
      'day',
    ]);

    expect(process.exitCode).toBe(1);
    expect(stderrChunks.join('')).toContain('--metric per_model_cost requires --model');
  });

  it('rejects mismatched unit and period for daily cost alerts', () => {
    process.env['GREENCLAW_TELEMETRY_DB'] = createDbPath();

    runAlertsCommand([
      'set',
      '--name',
      'bad-daily-cost',
      '--metric',
      'daily_cost',
      '--threshold',
      '5',
      '--unit',
      'tokens',
      '--period',
      'month',
    ]);

    expect(process.exitCode).toBe(1);
    expect(stderrChunks.join('')).toContain('--metric daily_cost requires --unit usd');
    expect(stdoutChunks).toHaveLength(0);
  });

  it('rejects stray model filters on non-model metrics', () => {
    process.env['GREENCLAW_TELEMETRY_DB'] = createDbPath();

    runAlertsCommand([
      'set',
      '--name',
      'bad-model-filter',
      '--metric',
      'weekly_cost',
      '--threshold',
      '15',
      '--unit',
      'usd',
      '--period',
      'week',
      '--model',
      'gpt-4o-mini',
    ]);

    expect(process.exitCode).toBe(1);
    expect(stderrChunks.join('')).toContain('--model is only supported');
  });

  it('creates a valid per-model cost rule', () => {
    process.env['GREENCLAW_TELEMETRY_DB'] = createDbPath();

    runAlertsCommand([
      'set',
      '--name',
      'valid-cap',
      '--metric',
      'per_model_cost',
      '--threshold',
      '15',
      '--unit',
      'usd',
      '--period',
      'month',
      '--model',
      'gpt-4o-mini',
    ]);

    expect(process.exitCode).toBeUndefined();
    expect(stderrChunks).toHaveLength(0);
    expect(stdoutChunks.join('')).toContain('"metric": "per_model_cost"');
    expect(stdoutChunks.join('')).toContain('"model_filter": "gpt-4o-mini"');
  });
});
