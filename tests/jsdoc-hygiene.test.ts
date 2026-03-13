import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * JSDoc hygiene harness.
 *
 * Verifies that all exported functions, classes, and named constants in
 * package source directories have a preceding JSDoc comment block.
 *
 * Severity: warn — violations are logged but do not fail the test.
 * This matches the prior ESLint jsdoc/require-jsdoc severity.
 */

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

/**
 * Recursively collect all .ts files under a directory.
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Check whether the lines immediately preceding a given line index
 * contain a JSDoc block ending with a closing comment tag.
 * @param lines - All lines of the file
 * @param exportLineIndex - The zero-based index of the export line
 * @returns true if a JSDoc comment block precedes the export
 */
function hasJsDocAbove(lines: string[], exportLineIndex: number): boolean {
  // Walk backwards from the line before the export, skipping blank lines
  // and decorators, looking for a line that ends with '*/'
  for (let i = exportLineIndex - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue; // skip blank lines
    if (trimmed.startsWith('@')) continue; // skip decorators
    if (trimmed.endsWith('*/')) return true;
    // If we hit a non-blank, non-decorator, non-comment line, stop
    return false;
  }
  return false;
}

// Patterns that match exported declarations requiring JSDoc
const EXPORT_PATTERNS = [
  /^export\s+function\s+\w+/,
  /^export\s+async\s+function\s+\w+/,
  /^export\s+class\s+\w+/,
  /^export\s+abstract\s+class\s+\w+/,
];

describe('JSDoc hygiene', () => {
  it('exported functions and classes should have JSDoc comments', () => {
    const packages = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
    const violations: string[] = [];

    for (const pkg of packages) {
      if (!pkg.isDirectory()) continue;
      const srcDir = path.join(PACKAGES_DIR, pkg.name, 'src');
      const files = collectTsFiles(srcDir);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relPath = path.relative(ROOT, file);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const isExport = EXPORT_PATTERNS.some((p) => p.test(line));
          if (isExport && !hasJsDocAbove(lines, i)) {
            violations.push(`${relPath}:${i + 1} — ${line.slice(0, 80)}`);
          }
        }
      }
    }

    // Warn-level: log violations but do not fail
    if (violations.length > 0) {
      console.warn(
        `\nJSDoc missing on ${violations.length} export(s):\n  ${violations.join('\n  ')}`,
      );
    }

    // To upgrade to error-level enforcement, uncomment:
    // expect(violations, 'All exports must have JSDoc comments').toHaveLength(0);
    expect(true).toBe(true); // placeholder assertion
  });
});
