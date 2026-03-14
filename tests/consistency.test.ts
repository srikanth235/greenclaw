import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Consistency checks — periodic validation that documentation,
 * AGENTS.md files, and code structure stay in sync.
 *
 * Inspired by OpenAI's "periodic consistency agents" pattern from
 * harness engineering: deterministic rules that catch drift between
 * docs and reality.
 */

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const PACKAGES = [
  'types',
  'config',
  'telemetry',
  'optimization',
  'monitoring',
  'cli',
  'api',
  'dashboard',
] as const;

// ---------------------------------------------------------------------------
// Shared file-content cache — avoids redundant fs.readFileSync calls across
// tests in this file. Every test that reads CLAUDE.md, AGENTS.md, QUALITY.md,
// or package AGENTS.md files should use these cached values.
// ---------------------------------------------------------------------------

/**
 * Lazy, per-path file-content cache. Reads once, returns the same string.
 */
const fileCache = new Map<string, string>();

/**
 * Read a file, returning a cached copy if already read.
 * @param filePath - Absolute path
 * @returns File content as a string
 */
function cachedRead(filePath: string): string {
  let content = fileCache.get(filePath);
  if (content === undefined) {
    content = fs.readFileSync(filePath, 'utf-8');
    fileCache.set(filePath, content);
  }
  return content;
}

/**
 * Recursively collect files from a directory.
 * @param dir - Directory to scan
 * @param include - Optional file predicate
 * @returns Absolute file paths
 */
function findFiles(dir: string, include?: (filePath: string) => boolean): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath, include));
      continue;
    }
    if (!include || include(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Pre-resolved paths used in multiple describe blocks. */
const PATHS = {
  claudeMd: path.join(ROOT, 'CLAUDE.md'),
  agentsMd: path.join(ROOT, 'AGENTS.md'),
  architectureMd: path.join(ROOT, 'ARCHITECTURE.md'),
  contributingMd: path.join(ROOT, 'CONTRIBUTING.md'),
  qualityMd: path.join(ROOT, 'docs', 'QUALITY.md'),
  plansMd: path.join(ROOT, 'docs', 'PLANS.md'),
  designIndex: path.join(ROOT, 'docs', 'design', 'index.md'),
  greenclawSkill: path.join(ROOT, 'skill', 'greenclaw', 'SKILL.md'),
} as const;

describe('Consistency: AGENTS.md files', () => {
  it('every package directory has an AGENTS.md', () => {
    for (const pkg of PACKAGES) {
      const agentsPath = path.join(PACKAGES_DIR, pkg, 'AGENTS.md');
      expect(fs.existsSync(agentsPath), `Missing AGENTS.md in packages/${pkg}/`).toBe(true);
    }
  });

  it('no AGENTS.md exceeds 80 lines', () => {
    for (const pkg of PACKAGES) {
      const agentsPath = path.join(PACKAGES_DIR, pkg, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const lines = cachedRead(agentsPath).split('\n').length;
      expect(lines, `packages/${pkg}/AGENTS.md has ${lines} lines (max 80)`).toBeLessThanOrEqual(
        80,
      );
    }
  });

  it('root AGENTS.md references every package', () => {
    const rootAgents = cachedRead(PATHS.agentsMd);
    for (const pkg of PACKAGES) {
      expect(rootAgents, `Root AGENTS.md does not reference package "${pkg}"`).toContain(pkg);
    }
  });
});

describe('Consistency: package directories have index.ts', () => {
  it('every package has an src/index.ts entry point', () => {
    for (const pkg of PACKAGES) {
      const indexPath = path.join(PACKAGES_DIR, pkg, 'src', 'index.ts');
      expect(fs.existsSync(indexPath), `Missing src/index.ts in packages/${pkg}/`).toBe(true);
    }
  });
});

describe('Consistency: no forbidden project names', () => {
  // Build the forbidden pattern via concatenation so this test file
  // does not match its own regex scan.
  const FORBIDDEN = new RegExp(
    `${['Claw', 'Proxy'].join('')}|${['Inference', 'Proxy'].join('')}`,
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
    const dirs = [path.join(ROOT, 'packages'), path.join(ROOT, 'docs'), path.join(ROOT, 'tests')];
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
   * Matches patterns like [text](docs/design/philosophy.md) or [text](packages/types/AGENTS.md).
   * Ignores external URLs (http/https).
   * @param filePath - Absolute path to the markdown file
   * @returns Array of { linkPath, resolvedPath } objects
   */
  function extractLocalLinks(filePath: string): { linkPath: string; resolvedPath: string }[] {
    const content = cachedRead(filePath);
    const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
    const links: { linkPath: string; resolvedPath: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[1] as string;
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

  it('all links in package AGENTS.md files resolve to existing files', () => {
    const missing: string[] = [];

    for (const pkg of PACKAGES) {
      const agentsPath = path.join(PACKAGES_DIR, pkg, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const links = extractLocalLinks(agentsPath);

      for (const { linkPath, resolvedPath } of links) {
        if (!fs.existsSync(resolvedPath)) {
          missing.push(`packages/${pkg}/AGENTS.md → ${linkPath}`);
        }
      }
    }

    expect(
      missing,
      `Package AGENTS.md files have broken links: ${missing.join(', ')}`,
    ).toHaveLength(0);
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
    'docs/conventions/knowledge-store.md',
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

  it('root AGENTS.md stays under 200 lines', () => {
    const lines = cachedRead(PATHS.agentsMd).split('\n').length;
    expect(lines, `Root AGENTS.md has ${lines} lines (max 200)`).toBeLessThanOrEqual(200);
  });
});

describe('Consistency: skill command syntax', () => {
  it('greenclaw skill examples invoke the CLI with a spaced subcommand', () => {
    const skill = cachedRead(PATHS.greenclawSkill);
    const malformed = skill.match(/npx\s+greenclaw(?:usage|alerts|traces)\b/g) ?? [];
    expect(
      malformed,
      `Malformed greenclaw commands found in skill/greenclaw/SKILL.md: ${malformed.join(', ')}`,
    ).toHaveLength(0);

    const runnable = skill.match(/npx\s+greenclaw\s+(usage|alerts|traces)\b/g) ?? [];
    expect(
      runnable.length,
      'skill/greenclaw/SKILL.md should document runnable CLI commands',
    ).toBeGreaterThan(0);
  });
});

describe('Consistency: CLAUDE.md package map matches packages/', () => {
  /**
   * Extract package names from the CLAUDE.md "Package Map" table.
   * Matches rows like:
   *   | 0 | `packages/types/` | ...
   *   | 0 | `@greenclaw/types` | ...
   *   | 0 | `src/types/` | ...  (legacy format)
   * @returns Array of package directory names
   */
  function extractPackageMapEntries(): string[] {
    const claudeMd = cachedRead(PATHS.claudeMd);
    const packagePattern = /\|\s*\d+\s*\|\s*`?(?:packages\/|@greenclaw\/|src\/)(\w+)\/?`?/g;
    const entries: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = packagePattern.exec(claudeMd)) !== null) {
      entries.push(match[1] as string);
    }
    return entries;
  }

  it('every package directory appears in the CLAUDE.md package map', () => {
    const mapEntries = extractPackageMapEntries();
    const missing: string[] = [];
    for (const pkg of PACKAGES) {
      if (!mapEntries.includes(pkg)) {
        missing.push(pkg);
      }
    }
    expect(
      missing,
      `Packages missing from CLAUDE.md package map: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Package Map" table in CLAUDE.md for each missing package.`,
    ).toHaveLength(0);
  });

  it('CLAUDE.md package map has no entries for directories that do not exist', () => {
    const mapEntries = extractPackageMapEntries();
    const phantom: string[] = [];
    for (const entry of mapEntries) {
      if (!fs.existsSync(path.join(PACKAGES_DIR, entry))) {
        phantom.push(entry);
      }
    }
    expect(
      phantom,
      `CLAUDE.md package map references non-existent directories: ${phantom.join(', ')}. ` +
        `Fix: remove the stale row(s) from CLAUDE.md or create the missing packages/ directory.`,
    ).toHaveLength(0);
  });
});

describe('Consistency: QUALITY.md covers all packages', () => {
  const VALID_GRADES = new Set(['A', 'B', 'C', 'D']);
  const REQUIRED_HARNESS_ROWS = [
    'Harness: suppression hygiene',
    'Harness: semantic owner-docs',
    'Harness: telemetry contracts',
    'Harness: proxy contracts',
    'Harness: fixture eval',
  ] as const;

  /**
   * Parse the Module/Package Quality table from QUALITY.md.
   * @returns Map of package name → grade
   */
  function parseQualityTable(): Map<string, string> {
    const content = cachedRead(PATHS.qualityMd);
    // Match rows like: | types/      | Stub           | N/A           | Complete | D     | ...
    const rowPattern = /\|\s*(\w+)\/?\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z])\s*\|/g;
    const grades = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(content)) !== null) {
      grades.set(match[1] as string, match[2] as string);
    }
    return grades;
  }

  function parseQualityNotes(): Map<string, string> {
    const content = cachedRead(PATHS.qualityMd);
    const rowPattern = /\|\s*(\w+)\/?\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z])\s*\|\s*([^|]+)\|/g;
    const notes = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(content)) !== null) {
      notes.set(match[1] as string, (match[3] as string).trim());
    }
    return notes;
  }

  function parseCrossCuttingRows(): Set<string> {
    const content = cachedRead(PATHS.qualityMd);
    const rowPattern = /^\|\s*([^|]+?)\s*\|\s*(?:Active|Documented|Partial)\s*\|\s*[A-D]\s*\|/gm;
    const rows = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(content)) !== null) {
      rows.add((match[1] as string).trim());
    }
    return rows;
  }

  it('every package has a row in QUALITY.md', () => {
    const grades = parseQualityTable();
    const missing: string[] = [];
    for (const pkg of PACKAGES) {
      if (!grades.has(pkg)) {
        missing.push(pkg);
      }
    }
    expect(
      missing,
      `Packages missing from QUALITY.md: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Module Quality" table in docs/QUALITY.md.`,
    ).toHaveLength(0);
  });

  it('all grades in QUALITY.md are valid (A/B/C/D)', () => {
    const grades = parseQualityTable();
    const invalid: string[] = [];
    for (const [pkg, grade] of grades) {
      if (!VALID_GRADES.has(grade)) {
        invalid.push(`${pkg}/ has grade "${grade}"`);
      }
    }
    expect(
      invalid,
      `Invalid grades in QUALITY.md: ${invalid.join(', ')}. ` +
        `Fix: grades must be one of A, B, C, D.`,
    ).toHaveLength(0);
  });

  it('QUALITY.md includes required harness domain rows', () => {
    const rows = parseCrossCuttingRows();
    const missing: string[] = [];
    for (const required of REQUIRED_HARNESS_ROWS) {
      if (!rows.has(required)) {
        missing.push(required);
      }
    }
    expect(
      missing,
      `Required harness rows missing from docs/QUALITY.md: ${missing.join(', ')}. ` +
        `Fix: add the missing row(s) to the cross-cutting quality table.`,
    ).toHaveLength(0);
  });

  it('package A-grades record semantic PASS in the notes column', () => {
    const grades = parseQualityTable();
    const notes = parseQualityNotes();
    const missing: string[] = [];

    for (const [pkg, grade] of grades) {
      if (grade !== 'A') continue;
      const note = notes.get(pkg) ?? '';
      if (!/semantic\s+pass/i.test(note)) {
        missing.push(pkg);
      }
    }

    expect(
      missing,
      `A-grade packages must record a semantic PASS note in docs/QUALITY.md: ${missing.join(', ')}.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Autonomy readiness — every package must have a row in the Autonomy
// Readiness table in QUALITY.md.
// ---------------------------------------------------------------------------

describe('Consistency: QUALITY.md autonomy readiness covers all packages', () => {
  /**
   * Parse the Autonomy Readiness table from QUALITY.md.
   * @returns Set of package names found in the table
   */
  function parseAutonomyTable(): Set<string> {
    const content = cachedRead(PATHS.qualityMd);
    const rowPattern = /\|\s*(\w+)\/?\s*\|\s*(?:Yes|No)\s*\|/g;
    const packages = new Set<string>();
    let match: RegExpExecArray | null;
    // Only match rows after the Autonomy Readiness heading
    const autonomySection = content.indexOf('## Autonomy Readiness');
    if (autonomySection === -1) return packages;
    const sectionContent = content.slice(autonomySection);
    while ((match = rowPattern.exec(sectionContent)) !== null) {
      packages.add(match[1] as string);
    }
    return packages;
  }

  it('every package has a row in the Autonomy Readiness table', () => {
    const listed = parseAutonomyTable();
    const missing: string[] = [];
    for (const pkg of PACKAGES) {
      if (!listed.has(pkg)) {
        missing.push(pkg);
      }
    }
    expect(
      missing,
      `Packages missing from QUALITY.md Autonomy Readiness table: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Autonomy Readiness" table in docs/QUALITY.md.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Autonomy tiers — critical-tier packages must maintain grade >= B.
// ---------------------------------------------------------------------------

describe('Consistency: autonomy tier validation', () => {
  const CRITICAL_PACKAGES = ['api', 'telemetry'] as const;

  it('critical-tier packages have grade >= B in QUALITY.md', () => {
    const content = cachedRead(PATHS.qualityMd);
    const rowPattern = /\|\s*(\w+)\/?\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z])\s*\|/g;
    const grades = new Map<string, string>();
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(content)) !== null) {
      grades.set(match[1] as string, match[2] as string);
    }

    const violations: string[] = [];
    for (const pkg of CRITICAL_PACKAGES) {
      const grade = grades.get(pkg);
      if (!grade || (grade !== 'A' && grade !== 'B')) {
        violations.push(`${pkg}/ has grade "${grade ?? 'missing'}" (critical tier requires >= B)`);
      }
    }

    expect(
      violations,
      `Critical-tier grade violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: critical-tier packages (${CRITICAL_PACKAGES.join(', ')}) must maintain grade >= B.`,
    ).toHaveLength(0);
  });

  it('every package in PACKAGES has a tier assignment in doc-governance.md', () => {
    const content = cachedRead(path.join(ROOT, 'docs', 'conventions', 'doc-governance.md'));
    const missing: string[] = [];
    for (const pkg of PACKAGES) {
      if (!content.includes(`\`${pkg}\``)) {
        missing.push(pkg);
      }
    }
    expect(
      missing,
      `Packages missing from autonomy tier table in doc-governance.md: ${missing.join(', ')}. ` +
        `Fix: assign every package to a tier in the "Autonomy Tiers" table.`,
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
    const content = cachedRead(PATHS.plansMd);
    const linkPattern = /\[PLAN-\d+\]\((exec-plans\/[^)]+\.md)\)/g;
    const links: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1] as string);
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

// ---------------------------------------------------------------------------
// Exec-plan lifecycle — plans in active/ must say Active, completed/ must say
// Completed, and no stray plan files should sit in the root exec-plans/ dir.
// ---------------------------------------------------------------------------

describe('Consistency: exec-plan lifecycle', () => {
  /**
   * Read a plan file and extract its Status line.
   * @param filePath - Absolute path to the plan file
   * @returns The status string, or null if not found
   */
  function extractPlanStatus(filePath: string): string | null {
    const content = cachedRead(filePath);
    const match = content.match(/\*\*Status\*\*:\s*(.+)/);
    return match ? match[1]?.trim() : null;
  }

  it('plans in active/ have Active status', () => {
    const activeDir = path.join(ROOT, 'docs', 'exec-plans', 'active');
    if (!fs.existsSync(activeDir)) return;
    const violations: string[] = [];
    for (const entry of fs.readdirSync(activeDir)) {
      if (!entry.endsWith('.md')) continue;
      const status = extractPlanStatus(path.join(activeDir, entry));
      if (status && !status.toLowerCase().startsWith('active')) {
        violations.push(`active/${entry} has status "${status}" (expected "Active ...")`);
      }
    }
    expect(
      violations,
      `Plan lifecycle violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: plans in active/ must have status starting with "Active".`,
    ).toHaveLength(0);
  });

  it('plans in completed/ have Completed status', () => {
    const completedDir = path.join(ROOT, 'docs', 'exec-plans', 'completed');
    if (!fs.existsSync(completedDir)) return;
    const violations: string[] = [];
    for (const entry of fs.readdirSync(completedDir)) {
      if (!entry.endsWith('.md')) continue;
      const status = extractPlanStatus(path.join(completedDir, entry));
      if (status && !status.toLowerCase().startsWith('completed')) {
        violations.push(`completed/${entry} has status "${status}" (expected "Completed ...")`);
      }
    }
    expect(
      violations,
      `Plan lifecycle violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: plans in completed/ must have status starting with "Completed".`,
    ).toHaveLength(0);
  });

  it('no plan files exist outside active/ or completed/', () => {
    const execPlansDir = path.join(ROOT, 'docs', 'exec-plans');
    if (!fs.existsSync(execPlansDir)) return;
    const stray: string[] = [];
    for (const entry of fs.readdirSync(execPlansDir)) {
      const fullPath = path.join(execPlansDir, entry);
      if (
        entry.startsWith('PLAN-') &&
        entry.endsWith('.md') &&
        !fs.statSync(fullPath).isDirectory()
      ) {
        stray.push(entry);
      }
    }
    expect(
      stray,
      `Plan files outside active/ or completed/: ${stray.join(', ')}. ` +
        `Fix: move plan files into docs/exec-plans/active/ or docs/exec-plans/completed/.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Doc backlinks — every document inside docs/ sub-directories must be
// reachable (linked) from at least one entry-point file. Catches orphan docs
// that rot silently (harness-engineering §3 progressive disclosure).
// ---------------------------------------------------------------------------

describe('Consistency: doc backlinks (no orphan docs)', () => {
  /**
   * Collect all local markdown links from a set of entry-point files.
   * @param entryFiles - Absolute paths to entry-point markdown files
   * @returns Set of resolved absolute paths that are linked to
   */
  function collectReachableDocs(entryFiles: string[]): Set<string> {
    const reachable = new Set<string>();
    const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;

    for (const entryFile of entryFiles) {
      if (!fs.existsSync(entryFile)) continue;
      const content = fs.readFileSync(entryFile, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(content)) !== null) {
        const linkPath = match[1] as string;
        if (linkPath.startsWith('http') || linkPath.startsWith('#')) continue;
        const resolved = path.resolve(path.dirname(entryFile), linkPath);
        reachable.add(resolved);
      }
    }
    return reachable;
  }

  /**
   * Find all markdown files in a directory recursively.
   * @param dir - Directory to scan
   * @returns Array of absolute file paths
   */
  function findMdFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findMdFiles(fullPath));
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('every doc in docs/design/ is reachable from an entry point', () => {
    const entryPoints = [
      path.join(ROOT, 'CLAUDE.md'),
      path.join(ROOT, 'AGENTS.md'),
      path.join(ROOT, 'ARCHITECTURE.md'),
      path.join(ROOT, 'docs', 'design', 'index.md'),
    ];
    const reachable = collectReachableDocs(entryPoints);
    const designDocs = findMdFiles(path.join(ROOT, 'docs', 'design')).filter(
      (f) => path.basename(f) !== 'index.md',
    );
    const orphans: string[] = [];
    for (const doc of designDocs) {
      if (!reachable.has(doc)) {
        orphans.push(path.relative(ROOT, doc));
      }
    }
    expect(
      orphans,
      `Orphan design docs (not linked from any entry point): ${orphans.join(', ')}. ` +
        `Fix: add a link from CLAUDE.md, docs/design/index.md, or a package AGENTS.md.`,
    ).toHaveLength(0);
  });

  it('every doc in docs/conventions/ is reachable from an entry point', () => {
    const entryPoints = [
      path.join(ROOT, 'CLAUDE.md'),
      path.join(ROOT, 'AGENTS.md'),
      path.join(ROOT, 'CONTRIBUTING.md'),
    ];
    const reachable = collectReachableDocs(entryPoints);
    const conventionDocs = findMdFiles(path.join(ROOT, 'docs', 'conventions'));
    const orphans: string[] = [];
    for (const doc of conventionDocs) {
      if (!reachable.has(doc)) {
        orphans.push(path.relative(ROOT, doc));
      }
    }
    expect(
      orphans,
      `Orphan convention docs (not linked from CLAUDE.md or CONTRIBUTING.md): ` +
        `${orphans.join(', ')}. Fix: add a link from CLAUDE.md or CONTRIBUTING.md.`,
    ).toHaveLength(0);
  });

  it('every doc in docs/exec-plans/ is reachable from PLANS.md or CLAUDE.md', () => {
    const entryPoints = [
      path.join(ROOT, 'CLAUDE.md'),
      path.join(ROOT, 'AGENTS.md'),
      path.join(ROOT, 'docs', 'PLANS.md'),
    ];
    const reachable = collectReachableDocs(entryPoints);
    const planDocs = findMdFiles(path.join(ROOT, 'docs', 'exec-plans'));
    const orphans: string[] = [];
    for (const doc of planDocs) {
      if (!reachable.has(doc)) {
        orphans.push(path.relative(ROOT, doc));
      }
    }
    expect(
      orphans,
      `Orphan exec-plan docs (not linked from PLANS.md or CLAUDE.md): ` +
        `${orphans.join(', ')}. Fix: add a link from docs/PLANS.md or CLAUDE.md.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AGENTS.md structure validation — every package AGENTS.md must have a
// consistent set of sections so agents can reliably parse them.
// ---------------------------------------------------------------------------

describe('Consistency: AGENTS.md structure validation', () => {
  const REQUIRED_SECTIONS = [
    'Ownership',
    'What it owns',
    'What it must NOT do',
    'Key invariants',
    'Dependencies',
  ] as const;

  it('every package AGENTS.md contains required sections', () => {
    const violations: string[] = [];

    for (const pkg of PACKAGES) {
      const agentsPath = path.join(PACKAGES_DIR, pkg, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const content = fs.readFileSync(agentsPath, 'utf-8');

      for (const section of REQUIRED_SECTIONS) {
        if (!content.includes(section)) {
          violations.push(`packages/${pkg}/AGENTS.md missing section: "${section}"`);
        }
      }
    }

    expect(
      violations,
      `AGENTS.md structure violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: every package AGENTS.md must contain: ${REQUIRED_SECTIONS.join(', ')}.`,
    ).toHaveLength(0);
  });

  it('AGENTS.md section headings are consistent across packages', () => {
    const coreHeadings = ['What it owns', 'What it must NOT do', 'Key invariants'];
    const violations: string[] = [];

    for (const pkg of PACKAGES) {
      const agentsPath = path.join(PACKAGES_DIR, pkg, 'AGENTS.md');
      if (!fs.existsSync(agentsPath)) continue;
      const content = fs.readFileSync(agentsPath, 'utf-8');
      const headings = [...content.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1]?.trim());

      for (const required of coreHeadings) {
        if (!headings.includes(required)) {
          violations.push(`packages/${pkg}/AGENTS.md missing heading: "### ${required}"`);
        }
      }
    }

    expect(
      violations,
      `Inconsistent AGENTS.md headings:\n  ${violations.join('\n  ')}\n` +
        `Fix: ensure every package AGENTS.md has: ${coreHeadings.map((h) => `### ${h}`).join(', ')}.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Convention coverage — every convention doc must appear in CLAUDE.md,
// every design doc must appear in the design index.
// ---------------------------------------------------------------------------

describe('Consistency: convention coverage in CLAUDE.md', () => {
  it('every convention doc in docs/conventions/ is listed in CLAUDE.md', () => {
    const conventionsDir = path.join(ROOT, 'docs', 'conventions');
    if (!fs.existsSync(conventionsDir)) return;

    const conventionFiles = fs.readdirSync(conventionsDir).filter((f) => f.endsWith('.md'));
    const claudeMd = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
    const missing: string[] = [];

    for (const file of conventionFiles) {
      if (!claudeMd.includes(file)) {
        missing.push(file);
      }
    }

    expect(
      missing,
      `Convention docs not listed in CLAUDE.md: ${missing.join(', ')}. ` +
        `Fix: add a row to the "Conventions" table in CLAUDE.md for each missing convention.`,
    ).toHaveLength(0);
  });

  it('every design doc in docs/design/ is listed in design/index.md', () => {
    const designDir = path.join(ROOT, 'docs', 'design');
    if (!fs.existsSync(designDir)) return;

    const designFiles = fs
      .readdirSync(designDir)
      .filter((f) => f.endsWith('.md') && f !== 'index.md');
    const indexPath = path.join(ROOT, 'docs', 'design', 'index.md');
    if (!fs.existsSync(indexPath)) return;
    const indexMd = fs.readFileSync(indexPath, 'utf-8');
    const missing: string[] = [];

    for (const file of designFiles) {
      if (!indexMd.includes(file)) {
        missing.push(file);
      }
    }

    expect(
      missing,
      `Design docs not listed in docs/design/index.md: ${missing.join(', ')}. ` +
        `Fix: add a row to the design index table for each missing document.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Design doc freshness — validate statuses in the design index are from the
// allowed set, catching typos and unrecognised lifecycle states.
// ---------------------------------------------------------------------------

describe('Consistency: design doc freshness', () => {
  const VALID_STATUSES = ['Verified', 'Accepted', 'Stale', 'Draft', 'Superseded'];

  it('every design doc in the index has a valid status', () => {
    const indexPath = path.join(ROOT, 'docs', 'design', 'index.md');
    if (!fs.existsSync(indexPath)) return;

    const content = fs.readFileSync(indexPath, 'utf-8');
    // Match rows like: | [001-philosophy](001-philosophy.md) | Verified | ...
    const rowPattern = /\|\s*\[[\w-]+\]\([^)]+\)\s*\|\s*(\w+)\s*\|/g;
    const invalid: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = rowPattern.exec(content)) !== null) {
      const status = match[1] as string;
      if (!VALID_STATUSES.includes(status)) {
        invalid.push(`status "${status}" is not one of: ${VALID_STATUSES.join(', ')}`);
      }
    }

    expect(
      invalid,
      `Invalid design doc statuses in index.md:\n  ${invalid.join('\n  ')}\n` +
        `Fix: valid statuses are: ${VALID_STATUSES.join(', ')}.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// README contracts — documented commands and tooling must match reality.
// ---------------------------------------------------------------------------

describe('Semantic: README script parity', () => {
  const BUILTIN_PNPM_COMMANDS = new Set(['install', 'exec', 'dlx']);

  /**
   * Extract `pnpm <script>` references from README.md.
   * @returns Array of script names
   */
  function extractReadmeScripts(): string[] {
    const readme = cachedRead(path.join(ROOT, 'README.md'));
    const scripts: string[] = [];
    const pattern = /^\s*pnpm\s+([a-z][\w:-]*)\b/gm;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(readme)) !== null) {
      scripts.push(match[1] as string);
    }

    return [...new Set(scripts)].filter((script) => !BUILTIN_PNPM_COMMANDS.has(script));
  }

  it('every README script exists in package.json', () => {
    const scripts = extractReadmeScripts();
    const pkgJson = JSON.parse(cachedRead(path.join(ROOT, 'package.json'))) as {
      scripts?: Record<string, string>;
    };
    const declared = new Set(Object.keys(pkgJson.scripts ?? {}));
    const missing = scripts.filter((script) => !declared.has(script));

    expect(
      missing,
      `README.md references scripts not in package.json: ${missing.join(', ')}. ` +
        `Fix: add the script to package.json or remove the stale README reference.`,
    ).toHaveLength(0);
  });
});

describe('Semantic: README runtime parity', () => {
  it('Quick Start/startup claims map to a real runtime entrypoint', () => {
    const readme = cachedRead(path.join(ROOT, 'README.md'));
    const pkgJson = JSON.parse(cachedRead(path.join(ROOT, 'package.json'))) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkgJson.scripts ?? {};

    if (readme.includes('pnpm dev')) {
      expect(scripts.dev, 'README references `pnpm dev` but package.json has no dev script').toBe(
        'tsx packages/api/src/main.ts',
      );
    }

    if (readme.includes('pnpm start')) {
      expect(
        scripts.start,
        'README references `pnpm start` but package.json has no start script',
      ).toBe('node packages/api/dist/main.js');
    }

    expect(
      fs.existsSync(path.join(ROOT, 'packages', 'api', 'src', 'main.ts')),
      'README startup docs require packages/api/src/main.ts to exist',
    ).toBe(true);
  });
});

describe('Semantic: README tooling parity', () => {
  it('README lint/format descriptions match actual tooling', () => {
    const readme = cachedRead(path.join(ROOT, 'README.md'));
    const pkgJson = JSON.parse(cachedRead(path.join(ROOT, 'package.json'))) as {
      devDependencies?: Record<string, string>;
    };
    const devDeps = Object.keys(pkgJson.devDependencies ?? {});
    const violations: string[] = [];

    if (/eslint/i.test(readme) && !devDeps.some((dep) => dep.includes('eslint'))) {
      violations.push('README mentions ESLint but package.json has no ESLint dependency');
    }
    if (/prettier/i.test(readme) && !devDeps.some((dep) => dep.includes('prettier'))) {
      violations.push('README mentions Prettier but package.json has no Prettier dependency');
    }
    if (/biome/i.test(readme) && !devDeps.includes('@biomejs/biome')) {
      violations.push('README mentions Biome but package.json has no @biomejs/biome dependency');
    }

    expect(
      violations,
      `README tooling drift detected:\n  ${violations.join('\n  ')}\n` +
        `Fix: update README.md to reflect the actual lint/format tooling.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Env var parity — .env.example must match what config/ actually reads.
// ---------------------------------------------------------------------------

describe('Semantic: env var parity', () => {
  /**
   * Extract variable names from .env.example.
   * @returns Set of env var names
   */
  function parseEnvExample(): Set<string> {
    const envPath = path.join(ROOT, '.env.example');
    if (!fs.existsSync(envPath)) return new Set();
    const content = cachedRead(envPath);
    const vars = new Set<string>();
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) vars.add(match[1] as string);
    }
    return vars;
  }

  /**
   * Find all env vars consumed by the config package.
   * Matches both `env.FOO` and `process.env.FOO`.
   * @returns Set of env var names
   */
  function findConsumedEnvVars(): Set<string> {
    const vars = new Set<string>();
    const configFiles = findFiles(path.join(ROOT, 'packages', 'config', 'src'), (filePath) =>
      filePath.endsWith('.ts'),
    );
    const patterns = [/\benv\.([A-Z_][A-Z0-9_]*)\b/g, /\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g];

    for (const filePath of configFiles) {
      const content = cachedRead(filePath);
      for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          vars.add(match[1] as string);
        }
      }
    }

    return vars;
  }

  /**
   * Find all env vars explicitly documented in security.md.
   * @returns Set of env var names
   */
  function findSecurityDocEnvVars(): Set<string> {
    const vars = new Set<string>();
    const content = cachedRead(path.join(ROOT, 'docs', 'conventions', 'security.md'));
    const pattern = /\b([A-Z_][A-Z0-9_]*)\b/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      if ((match[1] as string).includes('_')) {
        vars.add(match[1] as string);
      }
    }

    return vars;
  }

  it('every env var consumed in config/ appears in .env.example', () => {
    const documented = parseEnvExample();
    const consumed = findConsumedEnvVars();
    const missing: string[] = [];

    for (const variable of consumed) {
      if (!documented.has(variable)) {
        missing.push(variable);
      }
    }

    expect(
      missing,
      `Env vars read in config/ but missing from .env.example: ${missing.join(', ')}. ` +
        `Fix: add them to .env.example with placeholder values.`,
    ).toHaveLength(0);
  });

  it('every non-config env var in .env.example is explicitly documented in security.md', () => {
    const documented = parseEnvExample();
    const consumed = findConsumedEnvVars();
    const securityManaged = findSecurityDocEnvVars();
    const orphan: string[] = [];

    for (const variable of documented) {
      if (!consumed.has(variable) && !securityManaged.has(variable)) {
        orphan.push(variable);
      }
    }

    expect(
      orphan,
      `Env vars in .env.example are neither config-owned nor documented in security.md: ${orphan.join(', ')}. ` +
        `Fix: add them to packages/config/src/, document them in docs/conventions/security.md, or remove them from .env.example.`,
    ).toHaveLength(0);
  });

  it('observability docs reference the current log-level env var name', () => {
    const observability = cachedRead(path.join(ROOT, 'docs', 'conventions', 'observability.md'));
    expect(observability).toContain('GREENCLAW_LOG_LEVEL');
  });
});
