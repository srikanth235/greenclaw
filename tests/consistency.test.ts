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
    'Harness: telemetry contracts',
    'Harness: proxy contracts',
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

// ===========================================================================
// SEMANTIC DOC-CONTRACT CHECKS
// ===========================================================================

// ---------------------------------------------------------------------------
// README contracts — documented commands and tooling must match reality.
// ---------------------------------------------------------------------------

describe('Semantic: README script parity', () => {
  /**
   * Extract `pnpm <script>` references from README.md code blocks.
   * @returns Array of script names
   */
  function extractReadmeScripts(): string[] {
    const readme = cachedRead(path.join(ROOT, 'README.md'));
    // Only extract from fenced code blocks to avoid prose like "pnpm workspace monorepo"
    const codeBlockPattern = /```[\s\S]*?```/g;
    const scripts = new Set<string>();
    let block: RegExpExecArray | null;
    while ((block = codeBlockPattern.exec(readme)) !== null) {
      const scriptPattern = /pnpm\s+([\w:]+)/g;
      let match: RegExpExecArray | null;
      while ((match = scriptPattern.exec(block[0] as string)) !== null) {
        const name = match[1] as string;
        // Skip pnpm subcommands that aren't package.json scripts
        if (['install', 'exec', '-r', 'add', 'remove', 'init', 'dlx'].includes(name)) continue;
        scripts.add(name);
      }
    }
    return [...scripts];
  }

  it('every pnpm script referenced in README exists in package.json', () => {
    const pkgJson = JSON.parse(cachedRead(path.join(ROOT, 'package.json')));
    const definedScripts = new Set(Object.keys(pkgJson.scripts ?? {}));
    const readmeScripts = extractReadmeScripts();
    const missing: string[] = [];

    for (const script of readmeScripts) {
      if (!definedScripts.has(script)) {
        missing.push(script);
      }
    }

    expect(
      missing,
      `README.md references scripts not in package.json: ${missing.join(', ')}. ` +
        `Fix: add the script to package.json or remove the stale reference from README.md.`,
    ).toHaveLength(0);
  });
});

describe('Semantic: README tooling parity', () => {
  it('README lint/format descriptions match actual tooling', () => {
    const readme = cachedRead(path.join(ROOT, 'README.md'));
    const pkgJson = JSON.parse(cachedRead(path.join(ROOT, 'package.json')));
    const devDeps = Object.keys(pkgJson.devDependencies ?? {});
    const violations: string[] = [];

    // If Biome is the linter, README should not claim ESLint or Prettier
    const hasBiome = devDeps.some((d) => d.includes('biome'));
    const hasEslint = devDeps.some((d) => d.includes('eslint'));
    const hasPrettier = devDeps.some((d) => d.includes('prettier'));

    if (hasBiome && !hasEslint) {
      // Check for stale ESLint references in development section
      const devSection = readme.slice(readme.indexOf('## Development'));
      if (devSection && /\beslint\b/i.test(devSection)) {
        violations.push(
          'README Development section mentions ESLint but devDependencies uses Biome',
        );
      }
    }

    if (hasBiome && !hasPrettier) {
      const devSection = readme.slice(readme.indexOf('## Development'));
      if (devSection && /\bprettier\b/i.test(devSection)) {
        violations.push(
          'README Development section mentions Prettier but devDependencies uses Biome',
        );
      }
    }

    expect(
      violations,
      `README tooling drift:\n  ${violations.join('\n  ')}\n` +
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
   * Find all process.env.* references in packages/ source files.
   * @returns Set of env var names
   */
  function findConsumedEnvVars(): Set<string> {
    const vars = new Set<string>();
    const configDir = path.join(ROOT, 'packages', 'config', 'src');
    if (!fs.existsSync(configDir)) return vars;

    /**
     * Scan a directory for process.env references.
     * @param dir - Directory to scan
     */
    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const pattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(content)) !== null) {
            vars.add(match[1] as string);
          }
          // Also catch process.env['VAR'] and process.env["VAR"]
          const bracketPattern = /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g;
          while ((match = bracketPattern.exec(content)) !== null) {
            vars.add(match[1] as string);
          }
        }
      }
    }

    scan(configDir);
    return vars;
  }

  it('every env var consumed in config/ appears in .env.example', () => {
    const documented = parseEnvExample();
    const consumed = findConsumedEnvVars();
    const missing: string[] = [];

    for (const v of consumed) {
      if (!documented.has(v)) {
        missing.push(v);
      }
    }

    expect(
      missing,
      `Env vars read in config/ but missing from .env.example: ${missing.join(', ')}. ` +
        `Fix: add them to .env.example with placeholder values.`,
    ).toHaveLength(0);
  });

  it('every env var in .env.example is consumed somewhere in packages/', () => {
    const documented = parseEnvExample();
    if (documented.size === 0) return;

    // Scan packages/ (.ts) and docs/ (.md) — vars may be documented
    // in convention docs or AGENTS.md before config/ implements them.
    const consumed = new Set<string>();

    /**
     * Scan files in a directory for env var name references.
     * @param dir - Directory to scan
     * @param extensions - File extensions to check
     */
    function scanAll(dir: string, extensions: string[]): void {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanAll(fullPath, extensions);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const v of documented) {
            if (content.includes(v)) {
              consumed.add(v);
            }
          }
        }
      }
    }

    scanAll(path.join(ROOT, 'packages'), ['.ts', '.md']);
    scanAll(path.join(ROOT, 'docs'), ['.md']);

    const orphan: string[] = [];
    for (const v of documented) {
      if (!consumed.has(v)) {
        orphan.push(v);
      }
    }

    expect(
      orphan,
      `Env vars in .env.example not referenced in packages/ or docs/: ${orphan.join(', ')}. ` +
        `Fix: remove orphan vars from .env.example or document them in a convention doc.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Status-doc boundaries — volatile implementation-status prose must only
// appear in designated status documents, not in timeless reference/design/
// convention docs.
// ---------------------------------------------------------------------------

describe('Semantic: status-doc boundaries', () => {
  /** Paths where volatile status language is acceptable. */
  const STATUS_DOCS = new Set([
    path.join(ROOT, 'docs', 'QUALITY.md'),
    path.join(ROOT, 'docs', 'PLANS.md'),
    path.join(ROOT, 'docs', 'exec-plans', 'tech-debt-tracker.md'),
  ]);

  /** Active plan files are also allowed to contain status prose. */
  function isActivePlan(filePath: string): boolean {
    return filePath.includes(path.join('docs', 'exec-plans', 'active'));
  }

  /**
   * Phrases that indicate volatile implementation status.
   * Each is tested as a case-insensitive whole-word pattern.
   */
  const VOLATILE_PHRASES = [
    'not yet implemented',
    'not yet wired',
    'stub',
    'in progress',
    'deferred',
    'pending implementation',
  ];

  const VOLATILE_PATTERN = new RegExp(VOLATILE_PHRASES.map((p) => `\\b${p}\\b`).join('|'), 'i');

  /**
   * Find markdown files in timeless doc directories.
   * @param dir - Directory to scan
   * @returns Array of absolute paths
   */
  function findTimelessDocs(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTimelessDocs(fullPath));
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('timeless docs do not contain volatile implementation-status prose', () => {
    const timelessDirs = [
      path.join(ROOT, 'docs', 'design'),
      path.join(ROOT, 'docs', 'references'),
      path.join(ROOT, 'docs', 'conventions'),
    ];

    const violations: string[] = [];

    for (const dir of timelessDirs) {
      const docs = findTimelessDocs(dir);
      for (const doc of docs) {
        if (STATUS_DOCS.has(doc) || isActivePlan(doc)) continue;
        const content = fs.readFileSync(doc, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] as string;
          if (VOLATILE_PATTERN.test(line)) {
            const relPath = path.relative(ROOT, doc);
            violations.push(`${relPath}:${i + 1}: "${line.trim()}"`);
          }
        }
      }
    }

    expect(
      violations,
      `Volatile status prose found in timeless docs:\n  ${violations.join('\n  ')}\n` +
        `Fix: move status claims to docs/QUALITY.md or docs/PLANS.md. ` +
        `Timeless docs (design/, references/, conventions/) should describe intended behavior, not current state.`,
    ).toHaveLength(0);
  });
});
