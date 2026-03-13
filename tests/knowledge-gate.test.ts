import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Relevance gate — path-specific doc requirements.
 *
 * When code or config changes relative to main, the gate requires
 * that the right documentation was also updated — not just "any"
 * knowledge-store file.
 */

interface GateRule {
  /** Human-readable label for error messages. */
  label: string;
  /** Predicate: does this changed file trigger the rule? */
  source: (file: string) => boolean;
  /** Every required doc predicate must match at least one changed file. */
  requiredAll?: Array<{ label: string; matches: (file: string) => boolean }>;
  /** At least one of these predicates must match a changed file. */
  requiredAny?: Array<{ label: string; matches: (file: string) => boolean }>;
}

/**
 * Helper: returns true if `file` is the owner doc for a package.
 * @param pkg - Package name
 * @returns Predicate function
 */
function pkgAgents(pkg: string): (file: string) => boolean {
  return (file) => file === `packages/${pkg}/AGENTS.md`;
}

/**
 * Helper: exact file predicate with a human-readable label.
 * @param file - Repository-relative path
 * @returns Requirement descriptor
 */
function exactDoc(file: string): { label: string; matches: (changed: string) => boolean } {
  return {
    label: file,
    matches: (changed) => changed === file,
  };
}

/**
 * Match any code/config/test/package metadata change owned by a package.
 * @param pkg - Package name
 * @returns Predicate function
 */
function pkgOwnedSurface(pkg: string): (file: string) => boolean {
  return (file) =>
    file.startsWith(`packages/${pkg}/`) &&
    file !== `packages/${pkg}/AGENTS.md` &&
    !file.startsWith(`packages/${pkg}/dist/`);
}

const GATE_RULES: GateRule[] = [
  ...['types', 'config', 'telemetry', 'optimization', 'monitoring', 'cli', 'api', 'dashboard'].map(
    (pkg): GateRule => ({
      label: `packages/${pkg}/`,
      source: pkgOwnedSurface(pkg),
      requiredAll: [{ label: `packages/${pkg}/AGENTS.md`, matches: pkgAgents(pkg) }],
    }),
  ),
  {
    label: 'packages/config/',
    source: pkgOwnedSurface('config'),
    requiredAll: [exactDoc('.env.example')],
  },
  {
    label: 'packages/telemetry/',
    source: pkgOwnedSurface('telemetry'),
    requiredAll: [exactDoc('docs/conventions/observability.md')],
  },
  {
    label: 'packages/api/',
    source: pkgOwnedSurface('api'),
    requiredAny: [
      exactDoc('README.md'),
      exactDoc('ARCHITECTURE.md'),
      exactDoc('docs/conventions/errors.md'),
      exactDoc('docs/conventions/observability.md'),
      exactDoc('docs/conventions/security.md'),
    ],
  },
  {
    label: 'CLI/root config/CI changes',
    source: (file) =>
      file.startsWith('packages/cli/') ||
      file === 'package.json' ||
      file === 'biome.json' ||
      file.startsWith('.github/workflows/') ||
      file.startsWith('.husky/'),
    requiredAny: [
      exactDoc('README.md'),
      exactDoc('CONTRIBUTING.md'),
      exactDoc('docs/conventions/testing.md'),
    ],
  },
];

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

/**
 * Get changed files relative to the main branch.
 * @returns Changed files result, or a skipped marker with reason
 */
function getChangedFiles():
  | { files: string[]; skipped: false }
  | { files: []; skipped: true; reason: string } {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim();

    if (currentBranch === 'main' || currentBranch === 'master') {
      return { files: [], skipped: true, reason: 'on main branch' };
    }

    const baseRef = resolveBaseRef();
    if (baseRef === null) {
      throw new Error(
        'Cannot resolve base branch: neither "main" nor "origin/main" exist. ' +
          'Ensure the CI checkout fetches the main branch (e.g. fetch-depth: 0 ' +
          'or explicit fetch of origin/main).',
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
    return { files: dedupedFiles, skipped: false };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Cannot resolve base branch')) {
      throw err;
    }
    return { files: [], skipped: true, reason: 'git unavailable' };
  }
}

describe('Knowledge Gate: path-specific doc requirements', () => {
  it('changed code/config paths have their required companion docs updated', () => {
    const result = getChangedFiles();
    if (result.skipped) return;

    const { files: changedFiles } = result;
    if (changedFiles.length === 0) return;

    const violations: string[] = [];

    for (const rule of GATE_RULES) {
      const triggered = changedFiles.some(rule.source);
      if (!triggered) continue;

      const missingAll =
        rule.requiredAll?.filter((requirement) => !changedFiles.some(requirement.matches)) ?? [];
      const missingAny =
        rule.requiredAny &&
        !rule.requiredAny.some((requirement) => changedFiles.some(requirement.matches))
          ? [rule.requiredAny.map((requirement) => requirement.label).join(' or ')]
          : [];

      if (missingAll.length > 0 || missingAny.length > 0) {
        violations.push(
          `${rule.label} missing ${[
            ...missingAll.map((requirement) => requirement.label),
            ...missingAny,
          ].join(', ')}`,
        );
      }
    }

    expect(
      violations,
      `Code/config changed but required companion docs were not updated.\n` +
        `Unsatisfied rules:\n  ${violations.join('\n  ')}\n\n` +
        `Changed files:\n  ${changedFiles.join('\n  ')}\n\n` +
        `See AGENTS.md "Knowledge Store First" for the full workflow.`,
    ).toHaveLength(0);
  });
});
