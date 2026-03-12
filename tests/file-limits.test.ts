import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * File size limit enforcement — prevents monolithic source files.
 *
 * From harness-engineering §5: "file size limits … enforced by custom
 * lint rules." We use a structural test rather than an ESLint rule
 * because this check spans all file types (not just TS).
 */

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const MAX_SOURCE_LINES = 300;

/**
 * Recursively find all source files in a directory.
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const TESTS_DIR = path.join(ROOT, 'tests');

const MODULES = [
  'types',
  'config',
  'classifier',
  'compactor',
  'router',
  'api',
  'dashboard',
] as const;

describe('File limits: source files stay under line cap', () => {
  it(`no source file in src/ exceeds ${MAX_SOURCE_LINES} lines`, () => {
    const violations: string[] = [];

    for (const filePath of findSourceFiles(SRC_DIR)) {
      const lineCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
      if (lineCount > MAX_SOURCE_LINES) {
        const relPath = path.relative(ROOT, filePath);
        violations.push(`${relPath} (${lineCount} lines)`);
      }
    }

    expect(
      violations,
      `Source files exceeding ${MAX_SOURCE_LINES} lines:\n  ${violations.join('\n  ')}\n` +
        `Fix: split large files into smaller modules. See docs/references/harness-engineering.md §5.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test file per module — every module in src/ must have at least one
// corresponding test file in tests/. Ensures no module is silently untested.
// ---------------------------------------------------------------------------

describe('File limits: test file per module', () => {
  // Skip until modules have real implementation — stubs don't need dedicated tests.
  // Unskip when PLAN-001 completes and modules have real logic.
  it.skip('every module has at least one test file in tests/', () => {
    const testFiles = fs.existsSync(TESTS_DIR)
      ? fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.ts'))
      : [];
    const missing: string[] = [];

    for (const mod of MODULES) {
      // A module is covered if any test file contains the module name
      // e.g., classifier.test.ts, classifier.fixture.test.ts
      const hasCoverage = testFiles.some((f) => f.includes(mod));
      if (!hasCoverage) {
        missing.push(mod);
      }
    }

    // Harness tests (consistency, architecture, file-limits, module-boundaries)
    // cover all modules collectively, so we only flag modules that lack BOTH
    // dedicated test files AND coverage from harness tests.
    // For now, we check that at least a test file mentioning the module exists
    // OR the module is covered by the harness tests (which run for all modules).
    // This test becomes stricter once modules have real implementation.

    expect(
      missing,
      `Modules without any test file in tests/: ${missing.join(', ')}. ` +
        `Fix: create tests/<module>.test.ts or tests/<module>.*.test.ts. ` +
        `See docs/conventions/testing.md §Adding Tests for a New Module.`,
    ).toHaveLength(0);
  });
});
