import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPackageNames } from './lib/frontmatter';

/**
 * File size limit enforcement — prevents monolithic source files.
 *
 * From harness-engineering §5: "file size limits ... enforced by custom
 * lint rules." We use a structural test rather than an ESLint rule
 * because this check spans all file types (not just TS).
 */

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
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

const PACKAGES = getPackageNames();

describe('File limits: source files stay under line cap', () => {
  it(`no source file in packages/*/src/ exceeds ${MAX_SOURCE_LINES} lines`, () => {
    const violations: string[] = [];

    for (const pkg of PACKAGES) {
      const srcDir = path.join(PACKAGES_DIR, pkg, 'src');
      for (const filePath of findSourceFiles(srcDir)) {
        const lineCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
        if (lineCount > MAX_SOURCE_LINES) {
          const relPath = path.relative(ROOT, filePath);
          violations.push(`${relPath} (${lineCount} lines)`);
        }
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
// Test file per package — every package must have at least one
// corresponding test file. Ensures no package is silently untested.
// ---------------------------------------------------------------------------

describe('File limits: test file per package', () => {
  it('every package has at least one test file', () => {
    const rootTestFiles = fs.existsSync(TESTS_DIR)
      ? fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.ts'))
      : [];
    const missing: string[] = [];

    for (const pkg of PACKAGES) {
      // Check for package-local tests in packages/<pkg>/tests/
      const pkgTestsDir = path.join(PACKAGES_DIR, pkg, 'tests');
      const hasPkgTests =
        fs.existsSync(pkgTestsDir) &&
        fs.readdirSync(pkgTestsDir).some((f) => f.endsWith('.test.ts'));

      // Also check root tests/ for files mentioning the package name
      const hasRootTests = rootTestFiles.some((f) => f.includes(pkg));

      if (!hasPkgTests && !hasRootTests) {
        missing.push(pkg);
      }
    }
    expect(
      missing,
      `Packages without any test file: ${missing.join(', ')}. ` +
        `Fix: create packages/<pkg>/tests/<pkg>.test.ts or tests/<pkg>.*.test.ts. ` +
        `See docs/conventions/testing.md §Adding Tests for a New Module.`,
    ).toHaveLength(0);
  });
});
