import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Consistency checks — periodic validation that documentation,
 * AGENTS.md files, and code structure stay in sync.
 *
 * Inspired by OpenAI's "periodic consistency agents" pattern from
 * harness engineering: deterministic rules that catch drift between
 * docs and reality.
 */

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const MODULES = [
  'types',
  'config',
  'classifier',
  'compactor',
  'router',
  'api',
  'dashboard',
] as const;

describe('Consistency: AGENTS.md files', () => {
  it('every module directory has an AGENTS.md', () => {
    for (const mod of MODULES) {
      const agentsPath = path.join(SRC_DIR, mod, 'AGENTS.md');
      expect(fs.existsSync(agentsPath), `Missing AGENTS.md in src/${mod}/`).toBe(true);
    }
  });

  it('no AGENTS.md exceeds 80 lines', () => {
    for (const mod of MODULES) {
      const agentsPath = path.join(SRC_DIR, mod, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const lines = fs.readFileSync(agentsPath, 'utf-8').split('\n').length;
      expect(lines, `src/${mod}/AGENTS.md has ${lines} lines (max 80)`).toBeLessThanOrEqual(80);
    }
  });

  it('root AGENTS.md references every module', () => {
    const rootAgents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf-8');
    for (const mod of MODULES) {
      expect(rootAgents, `Root AGENTS.md does not reference module "${mod}"`).toContain(mod);
    }
  });
});

describe('Consistency: module directories have index.ts', () => {
  it('every module has an index.ts entry point', () => {
    for (const mod of MODULES) {
      const indexPath = path.join(SRC_DIR, mod, 'index.ts');
      expect(fs.existsSync(indexPath), `Missing index.ts in src/${mod}/`).toBe(true);
    }
  });
});

describe('Consistency: no forbidden project names', () => {
  // Build the forbidden pattern via concatenation so this test file
  // does not match its own regex scan.
  const FORBIDDEN = new RegExp(
    ['Claw', 'Proxy'].join('') + '|' + ['Inference', 'Proxy'].join(''),
    'i',
  );

  // Files that reference forbidden names only in a "do not use" prohibition
  // context are allowlisted. These are guardrail docs, not violations.
  const ALLOWLIST = new Set([
    'AGENTS.md',
    'CONTRIBUTING.md',
    path.join('tests', 'consistency.test.ts'),
  ]);

  /**
   * Scan all .ts, .md, and .json files in a directory for forbidden names.
   * @param dir - Directory to scan
   * @param extensions - File extensions to check
   * @returns Array of violation descriptions
   */
  function findForbiddenNames(dir: string, extensions: string[]): string[] {
    const violations: string[] = [];
    if (!fs.existsSync(dir)) return violations;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        violations.push(...findForbiddenNames(fullPath, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        const relPath = path.relative(ROOT, fullPath);
        if (ALLOWLIST.has(relPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (FORBIDDEN.test(content)) {
          violations.push(relPath);
        }
      }
    }
    return violations;
  }

  it('no file contains forbidden project names', () => {
    const dirs = [path.join(ROOT, 'src'), path.join(ROOT, 'docs'), path.join(ROOT, 'tests')];
    const violations: string[] = [];
    for (const dir of dirs) {
      violations.push(...findForbiddenNames(dir, ['.ts', '.md', '.json']));
    }

    // Also check root files (excluding allowlisted ones)
    for (const file of ['README.md']) {
      const filePath = path.join(ROOT, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (FORBIDDEN.test(content)) {
          violations.push(file);
        }
      }
    }

    expect(violations, `Forbidden names found in: ${violations.join(', ')}`).toHaveLength(0);
  });
});

describe('Consistency: doc cross-links', () => {
  /**
   * Extract markdown links from a file that point to local paths.
   * Matches patterns like [text](docs/design/philosophy.md) or [text](src/types/AGENTS.md).
   * Ignores external URLs (http/https).
   * @param filePath - Absolute path to the markdown file
   * @returns Array of { linkPath, resolvedPath } objects
   */
  function extractLocalLinks(filePath: string): { linkPath: string; resolvedPath: string }[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
    const links: { linkPath: string; resolvedPath: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[1]!;
      // Skip external URLs and anchors
      if (linkPath.startsWith('http') || linkPath.startsWith('#')) continue;
      const resolvedPath = path.resolve(path.dirname(filePath), linkPath);
      links.push({ linkPath, resolvedPath });
    }

    return links;
  }

  it('all links in root AGENTS.md resolve to existing files', () => {
    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const links = extractLocalLinks(agentsPath);
    const missing: string[] = [];

    for (const { linkPath, resolvedPath } of links) {
      if (!fs.existsSync(resolvedPath)) {
        missing.push(linkPath);
      }
    }

    expect(missing, `AGENTS.md has broken links: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('all links in module AGENTS.md files resolve to existing files', () => {
    const missing: string[] = [];

    for (const mod of MODULES) {
      const agentsPath = path.join(SRC_DIR, mod, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const links = extractLocalLinks(agentsPath);

      for (const { linkPath, resolvedPath } of links) {
        if (!fs.existsSync(resolvedPath)) {
          missing.push(`src/${mod}/AGENTS.md → ${linkPath}`);
        }
      }
    }

    expect(missing, `Module AGENTS.md files have broken links: ${missing.join(', ')}`).toHaveLength(
      0,
    );
  });
});

describe('Consistency: knowledge store structure', () => {
  /**
   * Required knowledge store files that must exist for the docs/
   * system of record to be complete.
   */
  const REQUIRED_DOCS = [
    'ARCHITECTURE.md',
    'docs/PLANS.md',
    'docs/PRODUCT_SENSE.md',
    'docs/QUALITY.md',
    'docs/design/001-philosophy.md',
    'docs/design/002-core-beliefs.md',
    'docs/exec-plans/tech-debt-tracker.md',
    'docs/conventions/errors.md',
    'docs/conventions/observability.md',
    'docs/conventions/testing.md',
    'docs/conventions/security.md',
  ] as const;

  it('all required knowledge store documents exist', () => {
    const missing: string[] = [];

    for (const doc of REQUIRED_DOCS) {
      const fullPath = path.join(ROOT, doc);
      if (!fs.existsSync(fullPath)) {
        missing.push(doc);
      }
    }

    expect(missing, `Missing required docs: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('root AGENTS.md stays under 100 lines', () => {
    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const lines = fs.readFileSync(agentsPath, 'utf-8').split('\n').length;
    expect(lines, `Root AGENTS.md has ${lines} lines (max 100)`).toBeLessThanOrEqual(100);
  });
});
