import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Relevance gate — path-specific doc requirements.
 *
 * When code or config changes relative to main, the gate requires
 * that the *right* documentation was also updated — not just "any"
 * knowledge-store file.
 *
 * This replaces the previous gate which checked `src/` (a directory
 * that does not exist in the monorepo layout).
 */

// ---------------------------------------------------------------------------
// Rule table: each entry maps a changed-path pattern to a set of required
// companion doc patterns. If any file matching `source` changed, at least
// one file matching one of the `requiredDocs` patterns must also have changed.
// ---------------------------------------------------------------------------

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
 * Helper: returns true if `file` is inside `packages/<pkg>/AGENTS.md`.
 * @param pkg - Package name
 * @returns Predicate function
 */
function pkgAgents(pkg: string): (file: string) => boolean {
  return (f) => f === `packages/${pkg}/AGENTS.md`;
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

const GATE_RULES: GateRule[] = [
  // -- Every package: src/ changes require that package's AGENTS.md --
  ...['types', 'config', 'telemetry', 'optimization', 'monitoring', 'cli', 'api', 'dashboard'].map(
    (pkg): GateRule => ({
      label: `packages/${pkg}/src/`,
      source: (f) => f.startsWith(`packages/${pkg}/src/`),
      requiredAll: [
        {
          label: `packages/${pkg}/AGENTS.md`,
          matches: pkgAgents(pkg),
        },
      ],
    }),
  ),

  // -- config/ additionally requires .env.example --
  {
    label: 'packages/config/src/',
    source: (f) => f.startsWith('packages/config/src/'),
    requiredAll: [exactDoc('.env.example')],
  },

  // -- telemetry/ additionally requires observability docs --
  {
    label: 'packages/telemetry/src/',
    source: (f) => f.startsWith('packages/telemetry/src/'),
    requiredAll: [exactDoc('docs/conventions/observability.md')],
  },

  // -- api/ additionally requires a shared behavior doc --
  {
    label: 'packages/api/src/',
    source: (f) => f.startsWith('packages/api/src/'),
    requiredAny: [
      exactDoc('ARCHITECTURE.md'),
      exactDoc('docs/conventions/errors.md'),
      exactDoc('docs/conventions/observability.md'),
      exactDoc('docs/conventions/security.md'),
    ],
  },

  // -- CLI, root config, CI: require README or CONTRIBUTING --
  {
    label: 'CLI/config/CI changes',
    source: (f) =>
      f.startsWith('packages/cli/src/') ||
      f === 'package.json' ||
      f === 'biome.json' ||
      f.startsWith('.husky/') ||
      f.startsWith('.github/workflows/'),
    requiredAny: [exactDoc('README.md'), exactDoc('CONTRIBUTING.md')],
  },
];

// ---------------------------------------------------------------------------
// Git helpers (unchanged from previous implementation)
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

    const diff = execSync(`git diff --name-only ${mergeBase}...HEAD`, {
      encoding: 'utf-8',
    }).trim();

    const files = diff ? diff.split('\n').filter(Boolean) : [];
    return { files, skipped: false };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Cannot resolve base branch')) {
      throw err;
    }
    return { files: [], skipped: true, reason: 'git unavailable' };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
        `See CLAUDE.md "Knowledge Store First" for the full workflow.`,
    ).toHaveLength(0);
  });
});
