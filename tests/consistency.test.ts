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

  it('root AGENTS.md stays under 120 lines', () => {
    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const lines = fs.readFileSync(agentsPath, 'utf-8').split('\n').length;
    expect(lines, `Root AGENTS.md has ${lines} lines (max 120)`).toBeLessThanOrEqual(120);
  });
});

describe('Consistency: CLAUDE.md module map matches src/', () => {
  /**
   * Extract module names from the CLAUDE.md "Module Map" table.
   * Matches rows like: | 0 | `src/types/` | ...
   * @returns Array of module directory names
   */
  function extractModuleMapEntries(): string[] {
    const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
    const modulePattern = /\|\s*\d+\s*\|\s*`src\/(\w+)\/`/g;
    const entries: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = modulePattern.exec(claudeMd)) !== null) {
      entries.push(match[1]!);
    }
    return entries;
  }

  it('every src/ module directory appears in the CLAUDE.md module map', () => {
    const mapEntries = extractModuleMapEntries();
    const missing: string[] = [];
    for (const mod of MODULES) {
      if (!mapEntries.includes(mod)) {
        missing.push(mod);
      }
    }
    expect(
      missing,
      `Modules missing from CLAUDE.md module map: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Module Map" table in CLAUDE.md for each missing module.`,
    ).toHaveLength(0);
  });

  it('CLAUDE.md module map has no entries for directories that do not exist', () => {
    const mapEntries = extractModuleMapEntries();
    const phantom: string[] = [];
    for (const entry of mapEntries) {
      if (!fs.existsSync(path.join(SRC_DIR, entry))) {
        phantom.push(entry);
      }
    }
    expect(
      phantom,
      `CLAUDE.md module map references non-existent directories: ${phantom.join(', ')}. ` +
        `Fix: remove the stale row(s) from CLAUDE.md or create the missing src/ directory.`,
    ).toHaveLength(0);
  });
});

describe('Consistency: QUALITY.md covers all modules', () => {
  const VALID_GRADES = new Set(['A', 'B', 'C', 'D']);

  /**
   * Parse the Module Quality table from QUALITY.md.
   * @returns Map of module name → grade
   */
  function parseQualityTable(): Map<string, string> {
    const content = fs.readFileSync(path.join(ROOT, 'docs', 'QUALITY.md'), 'utf-8');
    // Match rows like: | types/      | Stub           | N/A           | Complete | D     | ...
    const rowPattern = /\|\s*(\w+)\/\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z])\s*\|/g;
    const grades = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(content)) !== null) {
      grades.set(match[1]!, match[2]!);
    }
    return grades;
  }

  it('every module has a row in QUALITY.md', () => {
    const grades = parseQualityTable();
    const missing: string[] = [];
    for (const mod of MODULES) {
      if (!grades.has(mod)) {
        missing.push(mod);
      }
    }
    expect(
      missing,
      `Modules missing from QUALITY.md: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Module Quality" table in docs/QUALITY.md.`,
    ).toHaveLength(0);
  });

  it('all grades in QUALITY.md are valid (A/B/C/D)', () => {
    const grades = parseQualityTable();
    const invalid: string[] = [];
    for (const [mod, grade] of grades) {
      if (!VALID_GRADES.has(grade)) {
        invalid.push(`${mod}/ has grade "${grade}"`);
      }
    }
    expect(
      invalid,
      `Invalid grades in QUALITY.md: ${invalid.join(', ')}. ` +
        `Fix: grades must be one of A, B, C, D.`,
    ).toHaveLength(0);
  });
});

describe('Consistency: PLANS.md index matches exec-plans on disk', () => {
  /**
   * Extract plan file references from PLANS.md.
   * Matches links like [PLAN-001](exec-plans/active/PLAN-001-proxy-skeleton.md)
   * @returns Array of relative paths (from docs/)
   */
  function extractPlanLinks(): string[] {
    const content = fs.readFileSync(path.join(ROOT, 'docs', 'PLANS.md'), 'utf-8');
    const linkPattern = /\[PLAN-\d+\]\((exec-plans\/[^)]+\.md)\)/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1]!);
    }
    return links;
  }

  /**
   * Find all PLAN-*.md files under docs/exec-plans/.
   * @param dir - Directory to scan
   * @returns Array of relative paths (from docs/)
   */
  function findPlanFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findPlanFiles(fullPath));
      } else if (entry.name.startsWith('PLAN-') && entry.name.endsWith('.md')) {
        files.push(path.relative(path.join(ROOT, 'docs'), fullPath));
      }
    }
    return files;
  }

  it('every plan file on disk is referenced in PLANS.md', () => {
    const indexed = new Set(extractPlanLinks());
    const onDisk = findPlanFiles(path.join(ROOT, 'docs', 'exec-plans'));
    const unindexed: string[] = [];
    for (const file of onDisk) {
      if (!indexed.has(file)) {
        unindexed.push(file);
      }
    }
    expect(
      unindexed,
      `Plan files not indexed in PLANS.md: ${unindexed.join(', ')}. ` +
        `Fix: add a row to docs/PLANS.md for each missing plan.`,
    ).toHaveLength(0);
  });

  it('every plan link in PLANS.md resolves to a file on disk', () => {
    const links = extractPlanLinks();
    const broken: string[] = [];
    for (const link of links) {
      const fullPath = path.join(ROOT, 'docs', link);
      if (!fs.existsSync(fullPath)) {
        broken.push(link);
      }
    }
    expect(
      broken,
      `PLANS.md references missing files: ${broken.join(', ')}. ` +
        `Fix: create the plan file or remove the stale link from PLANS.md.`,
    ).toHaveLength(0);
  });
});
