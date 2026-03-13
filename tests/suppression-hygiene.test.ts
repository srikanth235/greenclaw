import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = [
  'biome.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'tsconfig.test.json',
  'vitest.config.ts',
] as const;

const SCAN_DIRS = ['packages', 'tests'] as const;

const SUPPRESSION_PATTERNS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /@ts-expect-error/,
  /@ts-ignore/,
  /biome-ignore/,
  /eslint-disable/,
] as const;

const ID_PATTERN = /\b(PLAN|TD)-\d{3}\b/;

function collectFiles(): string[] {
  const files = TARGET_FILES.map((file) => path.join(ROOT, file)).filter((file) =>
    fs.existsSync(file),
  );

  for (const dirName of SCAN_DIRS) {
    const dir = path.join(ROOT, dirName);
    if (!fs.existsSync(dir)) continue;
    walk(dir, files);
  }

  return files.filter((file) => path.relative(ROOT, file) !== 'tests/suppression-hygiene.test.ts');
}

function walk(dir: string, files: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (
      entry.name.endsWith('.ts') ||
      entry.name.endsWith('.tsx') ||
      entry.name.endsWith('.mts') ||
      entry.name.endsWith('.cts')
    ) {
      files.push(fullPath);
    }
  }
}

function collectKnownIds(): Set<string> {
  const ids = new Set<string>();
  const plansMd = fs.readFileSync(path.join(ROOT, 'docs', 'PLANS.md'), 'utf-8');
  const debtMd = fs.readFileSync(
    path.join(ROOT, 'docs', 'exec-plans', 'tech-debt-tracker.md'),
    'utf-8',
  );

  for (const content of [plansMd, debtMd]) {
    const matches = content.match(/\b(?:PLAN|TD)-\d{3}\b/g) ?? [];
    for (const match of matches) {
      ids.add(match);
    }
  }

  return ids;
}

describe('Suppression Hygiene: no unmanaged source suppressions', () => {
  const knownIds = collectKnownIds();

  it('every suppression token includes a PLAN-xxx or TD-xxx on the same line', () => {
    const violations: string[] = [];

    for (const filePath of collectFiles()) {
      const relPath = path.relative(ROOT, filePath);
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index] as string;
        if (!SUPPRESSION_PATTERNS.some((pattern) => pattern.test(line))) continue;
        if (ID_PATTERN.test(line)) continue;
        violations.push(`${relPath}:${index + 1} — ${line.trim()}`);
      }
    }

    expect(
      violations,
      `Suppression tokens missing PLAN/TD ownership:\n  ${violations.join('\n  ')}\n` +
        `Fix: add PLAN-xxx or TD-xxx on the same line as the suppression token.`,
    ).toHaveLength(0);
  });

  it('every suppression reference points to a real PLAN-xxx or TD-xxx id', () => {
    const unknown: string[] = [];

    for (const filePath of collectFiles()) {
      const relPath = path.relative(ROOT, filePath);
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      for (let index = 0; index < lines.length; index++) {
        const line = lines[index] as string;
        if (!SUPPRESSION_PATTERNS.some((pattern) => pattern.test(line))) continue;

        const matches = line.match(/\b(?:PLAN|TD)-\d{3}\b/g) ?? [];
        for (const match of matches) {
          if (!knownIds.has(match)) {
            unknown.push(`${relPath}:${index + 1} references unknown id ${match}`);
          }
        }
      }
    }

    expect(
      unknown,
      `Suppression tokens reference unknown PLAN/TD ids:\n  ${unknown.join('\n  ')}\n` +
        `Fix: reference an id listed in docs/PLANS.md or docs/exec-plans/tech-debt-tracker.md.`,
    ).toHaveLength(0);
  });
});
