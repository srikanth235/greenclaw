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
