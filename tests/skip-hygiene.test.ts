import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Skip hygiene — every `it.skip` or `describe.skip` in the test suite
 * must be registered in an allowlist with a reason or linked plan.
 *
 * This prevents important guarantees from silently staying dormant.
 * When you add a new skip, you must add it to ALLOWED_SKIPS below.
 *
 * From harness-engineering §4: "enforce invariants mechanically."
 */

const TESTS_DIR = path.resolve(__dirname);

/**
 * Allowlisted skips — each entry is a test file + reason.
 * The test file is relative to tests/, the pattern is a substring
 * of the skipped test description.
 */
const ALLOWED_SKIPS: Array<{ file: string; pattern: string; reason: string }> = [
  {
    file: 'architecture.test.ts',
    pattern: 'no package imports from a higher layer',
    reason: 'Some packages are stubs with no imports to validate (PLAN-001)',
  },
  {
    file: 'file-limits.test.ts',
    pattern: 'every package has at least one test file',
    reason: 'Stubs do not need dedicated test files yet (PLAN-001)',
  },
  {
    file: 'classifier.fixture.test.ts',
    pattern: 'achieves ≥90% accuracy',
    reason: 'Classifier is stubbed — returns expected_tier (PLAN-001)',
  },
  {
    file: 'golden.test.ts',
    pattern: 'ChatCompletionResponseSchema',
    reason: 'Zod schemas in types/ not yet implemented (PLAN-001)',
  },
  {
    file: 'golden.test.ts',
    pattern: 'ErrorResponseSchema',
    reason: 'Zod schemas in types/ not yet implemented (PLAN-001)',
  },
  {
    file: 'golden.test.ts',
    pattern: 'RequestTraceSchema',
    reason: 'Zod schemas in types/ not yet implemented (PLAN-001)',
  },
  {
    file: 'proxy-contracts.test.ts',
    pattern: 'forwards upstream JSON response unchanged',
    reason: 'api/ module is a stub — proxy not yet implemented (PLAN-001)',
  },
  {
    file: 'proxy-contracts.test.ts',
    pattern: 'forwards upstream error responses unchanged',
    reason: 'api/ module is a stub — proxy not yet implemented (PLAN-001)',
  },
  {
    file: 'proxy-contracts.test.ts',
    pattern: 'preserves all request fields except model',
    reason: 'api/ module is a stub — proxy not yet implemented (PLAN-001)',
  },
  {
    file: 'proxy-contracts.test.ts',
    pattern: 'does not modify non-model fields',
    reason: 'api/ module is a stub — proxy not yet implemented (PLAN-001)',
  },
  {
    file: 'proxy-contracts.test.ts',
    pattern: '/health returns documented shape',
    reason: 'api/ module is a stub — server not yet implemented (PLAN-001)',
  },
];

/**
 * Find all test files in the tests/ directory.
 * @returns Array of absolute file paths
 */
function findTestFiles(): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(TESTS_DIR)) {
    if (entry.endsWith('.test.ts')) {
      files.push(path.join(TESTS_DIR, entry));
    }
  }
  return files;
}

/**
 * Extract skip locations from a test file.
 * @param filePath - Absolute path to the test file
 * @returns Array of { line, text } for each skip found
 */
function extractSkips(filePath: string): Array<{ line: number; text: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const skips: Array<{ line: number; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/\b(?:it|test|describe)\.skip\s*\(/.test(line)) {
      skips.push({ line: i + 1, text: line.trim() });
    }
  }

  return skips;
}

describe('Skip Hygiene: no unmanaged skips', () => {
  it('every it.skip and describe.skip is registered in the allowlist', () => {
    const unmanaged: string[] = [];

    for (const filePath of findTestFiles()) {
      const fileName = path.basename(filePath);
      const skips = extractSkips(filePath);

      for (const skip of skips) {
        const isAllowed = ALLOWED_SKIPS.some(
          (allowed) => allowed.file === fileName && skip.text.includes(allowed.pattern),
        );

        if (!isAllowed) {
          unmanaged.push(`${fileName}:${skip.line} — ${skip.text}`);
        }
      }
    }

    expect(
      unmanaged,
      `Unmanaged skipped tests found:\n  ${unmanaged.join('\n  ')}\n` +
        `Fix: add each skip to the ALLOWED_SKIPS list in tests/skip-hygiene.test.ts ` +
        `with a reason or linked plan. Skips without justification silently hide regressions.`,
    ).toHaveLength(0);
  });

  it('allowlisted skips still exist as actual skips in the codebase', () => {
    const stale: string[] = [];

    // Build a map of file → actual skip lines (parsed, not raw substring)
    const skipsByFile = new Map<string, Array<{ line: number; text: string }>>();
    for (const filePath of findTestFiles()) {
      const fileName = path.basename(filePath);
      const skips = extractSkips(filePath);
      if (skips.length > 0) {
        skipsByFile.set(fileName, skips);
      }
    }

    for (const allowed of ALLOWED_SKIPS) {
      const fileSkips = skipsByFile.get(allowed.file);

      if (!fileSkips) {
        // File either doesn't exist or has no skips at all
        const filePath = path.join(TESTS_DIR, allowed.file);
        if (!fs.existsSync(filePath)) {
          stale.push(`${allowed.file}: file does not exist`);
        } else {
          stale.push(`${allowed.file}: no skips found — pattern "${allowed.pattern}" is stale`);
        }
        continue;
      }

      // Check that at least one actual skip line contains the pattern
      const hasMatchingSkip = fileSkips.some((skip) => skip.text.includes(allowed.pattern));
      if (!hasMatchingSkip) {
        stale.push(
          `${allowed.file}: pattern "${allowed.pattern}" not found in any skip — ` +
            `the test may have been unskipped`,
        );
      }
    }

    expect(
      stale,
      `Stale allowlist entries (skip was removed but allowlist not updated):\n  ${stale.join('\n  ')}\n` +
        `Fix: remove the stale entry from ALLOWED_SKIPS in tests/skip-hygiene.test.ts.`,
    ).toHaveLength(0);
  });
});
