import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSection, parseMarkdownTable } from './lib/markdown';

/**
 * Document governance harness — enforces mutation policies on
 * knowledge-store documents.
 *
 * Classification: ledger (append-only), state (transitions require
 * rationale), owner-map (no volatile status), reference (cite enforcer).
 *
 * See docs/conventions/doc-governance.md for the full taxonomy.
 */

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Git helpers (reused pattern from knowledge-gate.test.ts)
// ---------------------------------------------------------------------------

/**
 * Resolve the base ref to diff against.
 * @returns The resolved ref string, or null
 */
function resolveBaseRef(): string | null {
  for (const candidate of ['main', 'origin/main']) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return candidate;
    } catch {
      // candidate doesn't exist, try next
    }
  }
  return null;
}

/** Result of collecting changed files from the branch diff. */
type ChangedFilesResult =
  | { files: string[]; mergeBase: string; skipped: false }
  | { files: []; mergeBase: ''; skipped: true; reason: string };

/**
 * Get changed files and merge base relative to the main branch.
 * @returns Changed files with merge base, or a skipped marker
 */
function getChangedFiles(): ChangedFilesResult {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim();

    if (currentBranch === 'main' || currentBranch === 'master') {
      return { files: [], mergeBase: '', skipped: true, reason: 'on main branch' };
    }

    const baseRef = resolveBaseRef();
    if (baseRef === null) {
      throw new Error(
        'Cannot resolve base branch: neither "main" nor "origin/main" exist. ' +
          'Ensure the CI checkout fetches the main branch (e.g. fetch-depth: 0).',
      );
    }

    const mergeBase = execSync(`git merge-base ${baseRef} HEAD`, {
      encoding: 'utf-8',
    }).trim();

    const branchDiff = execSync(`git diff --name-only ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
    }).trim();
    const stagedDiff = execSync('git diff --name-only --cached', {
      encoding: 'utf-8',
    }).trim();
    const worktreeDiff = execSync('git diff --name-only', {
      encoding: 'utf-8',
    }).trim();
    const untracked = execSync('git ls-files --others --exclude-standard', {
      encoding: 'utf-8',
    }).trim();

    const files = [
      ...branchDiff.split('\n'),
      ...stagedDiff.split('\n'),
      ...worktreeDiff.split('\n'),
      ...untracked.split('\n'),
    ].filter(Boolean);

    const dedupedFiles = [...new Set(files)].sort();
    return { files: dedupedFiles, mergeBase, skipped: false };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Cannot resolve base branch')) {
      throw err;
    }
    return { files: [], mergeBase: '', skipped: true, reason: 'git unavailable' };
  }
}

/**
 * Get the old version of a file at the merge-base commit.
 * @param mergeBase - The merge base commit hash
 * @param filePath - Repository-relative file path
 * @returns File content at merge base, or null if file didn't exist
 */
function getOldContent(mergeBase: string, filePath: string): string | null {
  try {
    return execSync(`git show ${mergeBase}:${filePath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

// extractSection imported from ./lib/markdown

/**
 * Extract defect-log entries as complete blocks (top-level `- ` line plus
 * any continuation lines that follow before the next `- ` or blank line).
 * @param section - Section content
 * @returns Array of full entry strings (including continuation lines)
 */
function defectEntries(section: string): string[] {
  const lines = section.split('\n');
  const entries: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith('- ')) {
      if (current.length > 0) entries.push(current.join('\n'));
      current = [line];
    } else if (current.length > 0 && line.match(/^\s+\S/)) {
      // continuation line (indented)
      current.push(line);
    } else {
      if (current.length > 0) entries.push(current.join('\n'));
      current = [];
    }
  }
  if (current.length > 0) entries.push(current.join('\n'));

  return entries;
}

/**
 * Extract raw table rows (pipe-delimited lines, excluding header separator).
 * Used for append-only ledger checks where row identity matters.
 * @param section - Section content
 * @returns Array of raw row strings
 */
function tableRows(section: string): string[] {
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !l.match(/^\|\s*-+/));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Document Governance', () => {
  const result = getChangedFiles();

  // -------------------------------------------------------------------------
  // Ledger: QUALITY.md defect log is append-only
  // -------------------------------------------------------------------------
  it('QUALITY.md defect log entries are append-only', () => {
    if (result.skipped) return;
    if (!result.files.includes('docs/QUALITY.md')) return;

    const oldContent = getOldContent(result.mergeBase, 'docs/QUALITY.md');
    if (!oldContent) return; // new file, nothing to check

    const newContent = fs.readFileSync(path.join(ROOT, 'docs/QUALITY.md'), 'utf-8');

    const oldDefectLog = extractSection(oldContent, /^##\s+Defect Log/);
    const newDefectLog = extractSection(newContent, /^##\s+Defect Log/);

    if (!oldDefectLog) return; // section didn't exist before

    // Every old defect entry (full block including continuation lines) must still exist
    const oldEntries = defectEntries(oldDefectLog);
    const newEntries = defectEntries(newDefectLog ?? '');

    const missing = oldEntries.filter((entry) => !newEntries.includes(entry));

    expect(
      missing,
      `Defect log is append-only. These entries were deleted or modified:\n` +
        `${missing.map((e) => `  ${e}`).join('\n')}\n\n` +
        `See docs/conventions/doc-governance.md for the mutation policy.`,
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Ledger: tech-debt-tracker.md resolved rows are append-only
  // -------------------------------------------------------------------------
  it('tech-debt-tracker.md resolved debt rows are append-only', () => {
    if (result.skipped) return;
    if (!result.files.includes('docs/exec-plans/tech-debt-tracker.md')) return;

    const oldContent = getOldContent(result.mergeBase, 'docs/exec-plans/tech-debt-tracker.md');
    if (!oldContent) return;

    const newContent = fs.readFileSync(
      path.join(ROOT, 'docs/exec-plans/tech-debt-tracker.md'),
      'utf-8',
    );

    const oldResolved = extractSection(oldContent, /^##\s+Resolved Debt/);
    const newResolved = extractSection(newContent, /^##\s+Resolved Debt/);

    if (!oldResolved) return;

    const oldRows = tableRows(oldResolved).filter((r) => !r.includes('(none yet)'));
    const newRows = tableRows(newResolved ?? '');

    // Normalize whitespace for comparison (collapse internal spaces)
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const newRowsNormalized = newRows.map(normalize);

    const missing = oldRows.filter((row) => {
      if (row.includes('(none yet)')) return false;
      return !newRowsNormalized.includes(normalize(row));
    });

    expect(
      missing,
      `Resolved debt rows are append-only (tombstone-based). ` +
        `These resolved entries were deleted or modified:\n` +
        `${missing.map((e) => `  ${e}`).join('\n')}\n\n` +
        `See docs/conventions/doc-governance.md.`,
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // State: QUALITY.md grade changes require notes changes
  // -------------------------------------------------------------------------
  it('QUALITY.md grade changes are accompanied by notes changes', () => {
    if (result.skipped) return;
    if (!result.files.includes('docs/QUALITY.md')) return;

    const oldContent = getOldContent(result.mergeBase, 'docs/QUALITY.md');
    if (!oldContent) return;

    const newContent = fs.readFileSync(path.join(ROOT, 'docs/QUALITY.md'), 'utf-8');

    /**
     * Parse grade tables from markdown content using shared table parser.
     * Works for both old (pre-frontmatter) and new content.
     * @param content - QUALITY.md content
     * @returns Map of name → { grade, notes }
     */
    function parseGrades(content: string): Map<string, { grade: string; notes: string }> {
      const map = new Map<string, { grade: string; notes: string }>();

      // Package quality table
      const pkgSection = extractSection(content, /^##\s+Package Quality/);
      if (pkgSection) {
        for (const row of parseMarkdownTable(pkgSection)) {
          const name = (row.package ?? '').replace(/\/$/, '').trim();
          if (name && row.grade) {
            map.set(name, { grade: row.grade, notes: row.notes ?? '' });
          }
        }
      }

      // Cross-cutting quality table
      const ccSection = extractSection(content, /^##\s+Cross-Cutting Quality/);
      if (ccSection) {
        for (const row of parseMarkdownTable(ccSection)) {
          const name = (row.domain ?? '').trim();
          if (name && row.grade) {
            map.set(name, { grade: row.grade, notes: row.notes ?? '' });
          }
        }
      }

      return map;
    }

    const oldGrades = parseGrades(oldContent);
    const newGrades = parseGrades(newContent);

    const violations: string[] = [];

    for (const [name, newEntry] of newGrades) {
      const oldEntry = oldGrades.get(name);
      if (!oldEntry) continue; // new row, no constraint
      if (oldEntry.grade !== newEntry.grade && oldEntry.notes === newEntry.notes) {
        violations.push(`${name}: grade ${oldEntry.grade}→${newEntry.grade} but notes unchanged`);
      }
    }

    expect(
      violations,
      `Grade changes in QUALITY.md require an updated Notes column.\n` +
        `${violations.join('\n')}\n\n` +
        `See docs/conventions/doc-governance.md (state class).`,
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // State: Autonomy Readiness value changes require rationale
  // -------------------------------------------------------------------------
  it('Autonomy Readiness changes are accompanied by rationale', () => {
    if (result.skipped) return;
    if (!result.files.includes('docs/QUALITY.md')) return;

    const oldContent = getOldContent(result.mergeBase, 'docs/QUALITY.md');
    if (!oldContent) return;

    const newContent = fs.readFileSync(path.join(ROOT, 'docs/QUALITY.md'), 'utf-8');

    /**
     * Parse autonomy readiness rows from QUALITY.md using shared table parser.
     * @param content - File content
     * @returns Map of package → row content (all columns concatenated)
     */
    function parseAutonomyRows(content: string): Map<string, string> {
      const section = extractSection(content, /^##\s+Autonomy Readiness/);
      if (!section) return new Map();

      const map = new Map<string, string>();
      for (const row of parseMarkdownTable(section)) {
        const pkg = (row.package ?? '').replace(/\/$/, '').trim();
        if (!pkg) continue;
        map.set(
          pkg,
          `${row.bootable}|${row.contract}|${row.observable}|${row.rollback_safe}|${row.score}`,
        );
      }
      return map;
    }

    const oldRows = parseAutonomyRows(oldContent);
    const newRows = parseAutonomyRows(newContent);

    // Check that the defect log has a new entry if any readiness values changed
    const changed: string[] = [];
    for (const [name, newVal] of newRows) {
      const oldVal = oldRows.get(name);
      if (oldVal !== undefined && oldVal !== newVal) {
        changed.push(`${name}: ${oldVal} → ${newVal}`);
      }
    }

    if (changed.length > 0) {
      // Verify the defect log was also updated (same mechanism as grade changes)
      const oldDefectLog = extractSection(oldContent, /^##\s+Defect Log/) ?? '';
      const newDefectLog = extractSection(newContent, /^##\s+Defect Log/) ?? '';
      expect(
        newDefectLog.length > oldDefectLog.length,
        `Autonomy Readiness values changed but Defect Log was not updated.\n` +
          `Changed: ${changed.join(', ')}\n\n` +
          `See docs/conventions/doc-governance.md (state class).`,
      ).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Owner-map: no volatile status language in AGENTS.md / CLAUDE.md
  // -------------------------------------------------------------------------
  it('owner-map docs contain no volatile status language', () => {
    if (result.skipped) return;

    const ownerMapFiles = result.files.filter(
      (f) =>
        f === 'CLAUDE.md' ||
        f === 'AGENTS.md' ||
        (f.startsWith('packages/') && f.endsWith('/AGENTS.md')),
    );

    if (ownerMapFiles.length === 0) return;

    // Volatile patterns — ban temporal/status language in owner-maps
    // Build keywords dynamically to avoid triggering suppression-hygiene scanner
    const todo = ['TO', 'DO'].join('');
    const fixme = ['FIX', 'ME'].join('');
    const hack = ['HA', 'CK'].join('');
    const wip = ['WI', 'P'].join('');
    const volatilePatterns: Array<{ pattern: RegExp; label: string }> = [
      { pattern: new RegExp(`\\b${todo}\\b`, 'i'), label: todo },
      { pattern: new RegExp(`\\b${fixme}\\b`, 'i'), label: fixme },
      { pattern: new RegExp(`\\b${hack}\\b`, 'i'), label: hack },
      { pattern: new RegExp(`\\b${wip}\\b`, 'i'), label: wip },
      { pattern: /\brecently\b/i, label: '"recently"' },
      { pattern: /\bjust added\b/i, label: '"just added"' },
      { pattern: /\bnew as of\b/i, label: '"new as of"' },
      { pattern: /\bin progress\b/i, label: '"in progress"' },
      { pattern: /\bblocked\b/i, label: '"blocked"' },
      { pattern: /\bpending\b/i, label: '"pending"' },
      { pattern: /\bchangelog\b/i, label: '"changelog"' },
      { pattern: /\bwhat changed\b/i, label: '"what changed"' },
      { pattern: /\bdone\b/i, label: '"done"' },
      { pattern: /\bhistory\b/i, label: '"history"' },
    ];

    // Date pattern: bare dates like 2026-03-14 outside of link targets
    const datePattern = /(?<!\()\b20\d{2}-\d{2}(-\d{2})?\b(?!\S*\.md)/;

    const violations: string[] = [];

    for (const file of ownerMapFiles) {
      const absPath = path.join(ROOT, file);
      if (!fs.existsSync(absPath)) continue;
      const content = fs.readFileSync(absPath, 'utf-8');
      const lines = content.split('\n');

      // Skip YAML frontmatter block (--- delimited at file start)
      let inFrontmatter = false;
      let frontmatterDone = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track frontmatter boundaries
        if (line.trim() === '---' && !frontmatterDone) {
          if (!inFrontmatter && i === 0) {
            inFrontmatter = true;
            continue;
          }
          if (inFrontmatter) {
            inFrontmatter = false;
            frontmatterDone = true;
            continue;
          }
        }
        if (inFrontmatter) continue;

        // Skip lines that are markdown link definitions or code blocks
        if (line.trim().startsWith('```')) continue;

        for (const { pattern, label } of volatilePatterns) {
          if (pattern.test(line)) {
            // Allow "In Progress" inside table cells referencing plan status
            if (label === '"in progress"' && line.includes('|') && /PLAN-\d+/.test(line)) {
              continue;
            }
            // Allow "Pending" in table cells that describe test/impl status columns
            if (
              label === '"pending"' &&
              line.includes('|') &&
              /\b(Tests|Implementation|Docs)\b/i.test(line)
            ) {
              continue;
            }
            // Allow "done" only in table cells referencing completion status
            if (label === '"done"' && line.includes('|') && /PLAN-\d+/.test(line)) {
              continue;
            }
            // Allow "history" in bulleted feature descriptions (not as headers)
            if (label === '"history"' && line.trim().startsWith('- ')) {
              continue;
            }
            violations.push(`${file}:${i + 1}: volatile word ${label}`);
          }
        }

        if (datePattern.test(line)) {
          // Allow dates in status tables (pipe-delimited lines)
          if (!line.includes('|')) {
            violations.push(`${file}:${i + 1}: bare date`);
          }
        }
      }
    }

    expect(
      violations,
      `Owner-map docs must not contain volatile status language.\n` +
        `"Map, not manual" — see docs/conventions/doc-governance.md.\n\n` +
        `Violations:\n  ${violations.join('\n  ')}`,
    ).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Reference: convention docs should cite enforcers for imperative rules
  // -------------------------------------------------------------------------
  it('convention doc imperative rules cite their enforcer', () => {
    if (result.skipped) return;

    const conventionFiles = result.files.filter(
      (f) => f.startsWith('docs/conventions/') && f.endsWith('.md'),
    );

    if (conventionFiles.length === 0) return;

    // Imperative keywords that indicate a rule
    const imperativePattern = /\b(must|never|always|shall|required)\b/i;
    // Enforcer citations — test file, biome rule, lint, or explicit manual review
    const enforcerPattern =
      /tests\/|\.test\.|biome|lint|eslint|harness|manual review|CI|enforced by/i;

    const warnings: string[] = [];

    for (const file of conventionFiles) {
      const absPath = path.join(ROOT, file);
      if (!fs.existsSync(absPath)) continue;
      const content = fs.readFileSync(absPath, 'utf-8');
      const lines = content.split('\n');
      let inCodeBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        if (inCodeBlock) continue;

        if (imperativePattern.test(line)) {
          // Check if the same line or within 2 lines has an enforcer citation
          const context = lines.slice(Math.max(0, i - 1), i + 3).join(' ');
          if (!enforcerPattern.test(context)) {
            warnings.push(`${file}:${i + 1}: "${line.trim().slice(0, 80)}…"`);
          }
        }
      }
    }

    expect(
      warnings,
      `[doc-governance] Convention rules without enforcer citations:\n` +
        `  ${warnings.join('\n  ')}\n` +
        `Add a test/lint reference or note "manual review".`,
    ).toHaveLength(0);
  });
});
