import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Module boundary enforcement — code-level taste checks that catch
 * convention violations mechanically.
 *
 * From harness-engineering §5: "Taste invariants — structured logging,
 * naming conventions, … enforced by custom lint rules." These tests
 * complement ESLint with checks that are easier to express as structural
 * tests.
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

/**
 * Recursively find all .ts source files (excluding tests) in a directory.
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// No hardcoded model names — model strings (e.g. "gpt-4", "claude-3")
// must only appear in config/. All other modules get models from config.
// ---------------------------------------------------------------------------

describe('Module Boundaries: No Hardcoded Model Names', () => {
  /**
   * Common model name patterns from major providers.
   * Matches strings like "gpt-4", "gpt-3.5-turbo", "claude-3-opus",
   * "gemini-pro", etc. Only matches inside string literals.
   */
  const MODEL_PATTERNS = [
    /['"]gpt-[34][^'"]*['"]/,
    /['"]claude-[0-9][^'"]*['"]/,
    /['"]gemini[^'"]*['"]/,
    /['"]llama[^'"]*['"]/,
    /['"]mistral[^'"]*['"]/,
    /['"]command-r[^'"]*['"]/,
  ];

  /** Modules where model name strings are allowed. */
  const ALLOWED_MODULES = new Set(['config', 'types']);

  it('model name strings only appear in config/ and types/', () => {
    const violations: string[] = [];

    for (const mod of MODULES) {
      if (ALLOWED_MODULES.has(mod)) continue;
      const moduleDir = path.join(SRC_DIR, mod);

      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const trimmed = line.trim();
          // Skip comments
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

          for (const pattern of MODEL_PATTERNS) {
            if (pattern.test(trimmed)) {
              violations.push(
                `src/${mod}/${path.relative(path.join(SRC_DIR, mod), filePath)}:${i + 1} ` +
                  `contains hardcoded model name`,
              );
              break;
            }
          }
        }
      }
    }

    expect(
      violations,
      `Hardcoded model names outside config/:\n  ${violations.join('\n  ')}\n` +
        `Fix: model names must come from config, not be inlined. ` +
        `See router/AGENTS.md: "Hardcode model names — all mappings come from config".`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No PII / secrets in log calls — structured logging must never include
// API keys, auth tokens, passwords, or similar sensitive data.
// Enforces security.md: "Never log API keys".
// ---------------------------------------------------------------------------

describe('Module Boundaries: No PII in Log Calls', () => {
  /**
   * Patterns that indicate potential PII or secret leakage in log output.
   * We scan for common dangerous patterns near logging-related code.
   */
  const SENSITIVE_PATTERNS = [
    /api[_-]?key/i,
    /api[_-]?secret/i,
    /authorization/i,
    /bearer\s+/i,
    /password/i,
    /secret[_-]?key/i,
    /access[_-]?token/i,
    /private[_-]?key/i,
    /credentials/i,
  ];

  /**
   * Patterns that identify logging calls (structured or otherwise).
   */
  const LOG_CALL_PATTERNS = [/\blogger\.\w+\s*\(/, /\blog\.\w+\s*\(/, /console\.\w+\s*\(/];

  it('no source file logs sensitive field names', () => {
    const violations: string[] = [];

    for (const mod of MODULES) {
      const moduleDir = path.join(SRC_DIR, mod);

      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

          // Check if the line is a log call or is within a likely log block
          const isLogLine = LOG_CALL_PATTERNS.some((p) => p.test(trimmed));
          if (!isLogLine) continue;

          for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(trimmed)) {
              violations.push(
                `src/${mod}/${path.relative(path.join(SRC_DIR, mod), filePath)}:${i + 1} ` +
                  `logs potentially sensitive data (matched ${pattern.source})`,
              );
              break;
            }
          }
        }
      }
    }

    expect(
      violations,
      `PII/secret leakage in log calls:\n  ${violations.join('\n  ')}\n` +
        `Fix: never log API keys, auth tokens, or credentials. ` +
        `See docs/conventions/security.md.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Zod as source of truth — in types/, every exported TypeScript type must
// be derived from a Zod schema via z.infer<>. No standalone interfaces for
// external-facing shapes (ADR-005).
// ---------------------------------------------------------------------------

describe('Module Boundaries: Zod as Source of Truth (types/)', () => {
  it('types/ does not export standalone interfaces or type aliases without z.infer', () => {
    const typesDir = path.join(SRC_DIR, 'types');
    const violations: string[] = [];

    for (const filePath of findTsFiles(typesDir)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // Detect exported interfaces (standalone, not z.infer derived)
        if (/^export\s+interface\s+\w+/.test(trimmed)) {
          violations.push(
            `src/types/${path.relative(typesDir, filePath)}:${i + 1} ` +
              `exports a standalone interface — use z.infer<> from a Zod schema instead`,
          );
        }

        // Detect exported type aliases that don't use z.infer
        if (
          /^export\s+type\s+\w+\s*=/.test(trimmed) &&
          !trimmed.includes('z.infer') &&
          !trimmed.includes('z.input')
        ) {
          // Allow union types and simple type aliases (e.g., type Foo = 'a' | 'b')
          // Only flag types that look like object shapes
          if (trimmed.includes('{') || /=\s*\w+Schema/.test(trimmed)) {
            // This is likely fine if it references a schema
          } else if (!trimmed.includes('|') && !trimmed.includes('typeof')) {
            violations.push(
              `src/types/${path.relative(typesDir, filePath)}:${i + 1} ` +
                `exports a type alias not derived from z.infer<> — ` +
                `see ADR-005 (Zod as source of truth)`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Zod source-of-truth violations in types/:\n  ${violations.join('\n  ')}\n` +
        `Fix: every exported type must be derived from a Zod schema via z.infer<>. ` +
        `See docs/design/005-zod-as-source-of-truth.md.`,
    ).toHaveLength(0);
  });

  it('types/ does not import from any other src/ module', () => {
    const typesDir = path.join(SRC_DIR, 'types');
    const violations: string[] = [];
    const otherModules = MODULES.filter((m) => m !== 'types');

    for (const filePath of findTsFiles(typesDir)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const mod of otherModules) {
        // Match imports from sibling modules like '../config/index.js'
        const importPattern = new RegExp(`from\\s+['"]\\.\\./${mod}(?:/[^'"]*)?['"]`);
        if (importPattern.test(content)) {
          violations.push(
            `src/types/${path.relative(typesDir, filePath)} imports from ${mod}/ — ` +
              `types is the bottom layer and must not import from any other module`,
          );
        }
      }
    }

    expect(
      violations,
      `Layer-zero violation in types/:\n  ${violations.join('\n  ')}\n` +
        `Fix: types/ must not import from any other src/ module.`,
    ).toHaveLength(0);
  });
});
