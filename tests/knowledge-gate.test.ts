import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

/**
 * Deterministic knowledge-store CI gate.
 *
 * If any file under src/ has changed relative to the main branch,
 * at least one knowledge-store file must also have changed. This
 * enforces the "document before implement" workflow without relying
 * on a local LLM hook.
 *
 * Knowledge-store files: docs/, AGENTS.md files, CLAUDE.md, ARCHITECTURE.md,
 * CONTRIBUTING.md.
 *
 * This test is a no-op on the main branch (nothing to diff against).
 */

/** Patterns that count as knowledge-store updates. */
const KNOWLEDGE_PATTERNS = [
  /^docs\//,
  /AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^ARCHITECTURE\.md$/,
  /^CONTRIBUTING\.md$/,
];

/**
 * Resolve the base ref to diff against. Tries local `main`, then
 * `origin/main`. Returns null if neither exists (not a failure —
 * the caller decides how to handle it).
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
 * Get the list of files changed relative to the main branch.
 * @returns Changed files result, or a skipped marker with reason
 */
function getChangedFiles():
  | { files: string[]; skipped: false }
  | { files: []; skipped: true; reason: string } {
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim();

    // No-op on main — nothing to diff against
    if (currentBranch === 'main' || currentBranch === 'master') {
      return { files: [], skipped: true, reason: 'on main branch' };
    }

    const baseRef = resolveBaseRef();
    if (baseRef === null) {
      // Neither main nor origin/main exists — this is a real problem
      // in CI (shallow clone without main). Fail loudly so it gets fixed.
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
    // Re-throw resolution errors — those should not be silenced
    if (err instanceof Error && err.message.startsWith('Cannot resolve base branch')) {
      throw err;
    }
    // Git not available or not a git repo — skip gracefully
    return { files: [], skipped: true, reason: 'git unavailable' };
  }
}

describe('Knowledge Gate: src/ changes require docs/ changes', () => {
  it('if src/ files changed, at least one knowledge-store file also changed', () => {
    const result = getChangedFiles();

    // Legitimate skip (on main, or git unavailable in non-CI context)
    if (result.skipped) return;

    const { files: changedFiles } = result;
    if (changedFiles.length === 0) return;

    const srcChanges = changedFiles.filter((f) => f.startsWith('src/'));
    if (srcChanges.length === 0) return; // No src/ changes, nothing to enforce

    const knowledgeChanges = changedFiles.filter((f) => KNOWLEDGE_PATTERNS.some((p) => p.test(f)));

    expect(
      knowledgeChanges.length,
      `src/ files changed but no knowledge-store files were updated.\n` +
        `Changed src/ files:\n  ${srcChanges.join('\n  ')}\n\n` +
        `Fix: update at least one knowledge-store file alongside src/ changes:\n` +
        `  - Module's AGENTS.md for behavior changes\n` +
        `  - docs/QUALITY.md for bug fixes\n` +
        `  - docs/exec-plans/ for new features\n` +
        `  - docs/design/ for architectural decisions\n` +
        `See CLAUDE.md "Knowledge Store First" for the full workflow.`,
    ).toBeGreaterThan(0);
  });
});
