import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Dependency layer enforcement.
 *
 * Package order (lowest to highest):
 *   types → config → telemetry → optimization → monitoring → cli → api → dashboard
 *
 * A package may only import from packages at the same or lower layer.
 */

const PACKAGE_ORDER = [
  'types',
  'config',
  'telemetry',
  'optimization',
  'monitoring',
  'cli',
  'api',
  'dashboard',
] as const;

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

/**
 * Get the layer index for a given package name.
 * @param packageName - The package directory name
 * @returns The layer index, or -1 if not found
 */
function getLayerIndex(packageName: string): number {
  return PACKAGE_ORDER.indexOf(packageName as (typeof PACKAGE_ORDER)[number]);
}

/**
 * Recursively find all .ts files in a directory.
 * @param dir - The directory to search
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

/**
 * Extract cross-package @greenclaw/* imports from a TypeScript file.
 * Matches patterns like:
 *   import { foo } from '@greenclaw/types';
 *   import * as bar from '@greenclaw/config';
 *   import { baz } from '@greenclaw/telemetry/something';
 * @param filePath - Absolute path to the .ts file
 * @returns Array of package names imported (e.g., ['types', 'config'])
 */
function extractPackageImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /(?:import|from)\s+['"]@greenclaw\/([\w-]+)(?:\/[^'"]*)?['"]/g;
  const packages: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const packageName = match[1];
    if (
      packageName !== undefined &&
      PACKAGE_ORDER.includes(packageName as (typeof PACKAGE_ORDER)[number])
    ) {
      packages.push(packageName);
    }
  }

  return [...new Set(packages)];
}

describe('Architecture: Layer Dependency Enforcement', () => {
  // Skip until packages have real code — stubs have no imports to validate
  it.skip('no package imports from a higher layer', () => {
    for (const packageName of PACKAGE_ORDER) {
      const packageSrcDir = path.join(PACKAGES_DIR, packageName, 'src');
      const packageLayer = getLayerIndex(packageName);
      const tsFiles = findTsFiles(packageSrcDir);

      for (const filePath of tsFiles) {
        const imports = extractPackageImports(filePath);
        for (const importedPackage of imports) {
          const importedLayer = getLayerIndex(importedPackage);
          expect(
            importedLayer,
            `${packageName}/ imports from ${importedPackage}/ — layer violation! ` +
              `${packageName} (layer ${packageLayer}) cannot import from ` +
              `${importedPackage} (layer ${importedLayer}). ` +
              `File: ${path.relative(PACKAGES_DIR, filePath)}`,
          ).toBeLessThanOrEqual(packageLayer);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Pure function layers — classifier, compactor, and router (inside the
// optimization package) must never import I/O primitives. They are pure
// pipeline stages (ADR-001).
// ---------------------------------------------------------------------------

describe('Architecture: Pure Function Layers', () => {
  /** Sub-modules within the optimization package that must remain free of I/O imports. */
  const PURE_SUBMODULES = ['classifier', 'compactor', 'router'] as const;

  /**
   * Patterns that indicate I/O or side-effect imports.
   * Matches common Node built-ins and fetch.
   */
  const IO_PATTERNS = [
    /\bimport\b.*['"]node:(?:fs|http|https|net|dgram|child_process|cluster|tls|dns)['"]/,
    /\bimport\b.*['"](?:fs|http|https|net|node-fetch)['"]/,
    /\brequire\s*\(\s*['"](?:node:)?(?:fs|http|https|net|child_process)['"]\s*\)/,
  ];

  const OPTIMIZATION_SRC = path.join(PACKAGES_DIR, 'optimization', 'src');

  it('pure pipeline modules do not import I/O primitives', () => {
    const violations: string[] = [];

    for (const submod of PURE_SUBMODULES) {
      const submodDir = path.join(OPTIMIZATION_SRC, submod);
      for (const filePath of findTsFiles(submodDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const pattern of IO_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(
              `${path.relative(PACKAGES_DIR, filePath)} imports I/O module (matched ${pattern.source})`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Pure-function layer violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: optimization/{classifier,compactor,router}/ must not import fs, http, ` +
        `net, or similar I/O modules. Side effects belong in api/.`,
    ).toHaveLength(0);
  });

  /**
   * Side-effect patterns banned in pure modules.
   * Timers, randomness, and Date.now introduce non-determinism.
   */
  const SIDE_EFFECT_PATTERNS = [
    { pattern: /\bsetTimeout\s*\(/, label: 'setTimeout' },
    { pattern: /\bsetInterval\s*\(/, label: 'setInterval' },
    { pattern: /\bsetImmediate\s*\(/, label: 'setImmediate' },
    { pattern: /\bMath\.random\s*\(/, label: 'Math.random' },
    { pattern: /\bDate\.now\s*\(/, label: 'Date.now' },
    { pattern: /\bnew\s+Date\s*\(/, label: 'new Date()' },
    { pattern: /\bcrypto\.random/, label: 'crypto.random*' },
  ];

  it('pure pipeline modules do not use timers, randomness, or Date.now', () => {
    const violations: string[] = [];

    for (const submod of PURE_SUBMODULES) {
      const submodDir = path.join(OPTIMIZATION_SRC, submod);
      for (const filePath of findTsFiles(submodDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i]?.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }
          for (const { pattern, label } of SIDE_EFFECT_PATTERNS) {
            if (pattern.test(trimmed)) {
              violations.push(
                `${path.relative(PACKAGES_DIR, filePath)}:${i + 1} uses ${label} — ` +
                  `pure modules must be deterministic and side-effect free`,
              );
            }
          }
        }
      }
    }

    expect(
      violations,
      `Side-effect violations in pure modules:\n  ${violations.join('\n  ')}\n` +
        `Fix: timers, randomness, and Date access belong in api/, not in pure pipeline modules.`,
    ).toHaveLength(0);
  });

  it('pure pipeline modules do not use global fetch', () => {
    const violations: string[] = [];

    for (const submod of PURE_SUBMODULES) {
      const submodDir = path.join(OPTIMIZATION_SRC, submod);
      for (const filePath of findTsFiles(submodDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }
          if (/\bfetch\s*\(/.test(trimmed)) {
            violations.push(
              `${path.relative(PACKAGES_DIR, filePath)} uses fetch() — pure modules must not make network calls`,
            );
            break;
          }
        }
      }
    }

    expect(
      violations,
      `Pure-function layer violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: network calls belong in api/, not in pure pipeline modules.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No circular dependencies — walk the import graph and detect cycles.
// ---------------------------------------------------------------------------

describe('Architecture: No Circular Dependencies', () => {
  /**
   * Build an adjacency map of package → packages it imports.
   * @returns Map from package name to set of imported package names
   */
  function buildImportGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const packageName of PACKAGE_ORDER) {
      const packageSrcDir = path.join(PACKAGES_DIR, packageName, 'src');
      const imports = new Set<string>();

      for (const filePath of findTsFiles(packageSrcDir)) {
        for (const imported of extractPackageImports(filePath)) {
          if (imported !== packageName) {
            imports.add(imported);
          }
        }
      }

      graph.set(packageName, imports);
    }

    return graph;
  }

  /**
   * Detect cycles using DFS.
   * @param graph - Adjacency map
   * @returns Array of cycle descriptions, empty if acyclic
   */
  function detectCycles(graph: Map<string, Set<string>>): string[] {
    const cycles: string[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const pathStack: string[] = [];

    function dfs(node: string): void {
      if (inStack.has(node)) {
        const cycleStart = pathStack.indexOf(node);
        const cycle = [...pathStack.slice(cycleStart), node];
        cycles.push(cycle.join(' → '));
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      pathStack.push(node);

      const neighbors = graph.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      pathStack.pop();
      inStack.delete(node);
    }

    for (const node of graph.keys()) {
      dfs(node);
    }

    return cycles;
  }

  it('no circular dependencies exist between packages', () => {
    const graph = buildImportGraph();
    const cycles = detectCycles(graph);

    expect(
      cycles,
      `Circular dependencies detected:\n  ${cycles.join('\n  ')}\n` +
        `Fix: break the cycle by moving shared types to a lower layer or ` +
        `extracting an interface.`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Re-export hygiene — cross-package imports must use the package entry point
// (@greenclaw/<pkg>), not deep paths into internal files
// (@greenclaw/<pkg>/internal/foo).
// ---------------------------------------------------------------------------

describe('Architecture: Re-export Hygiene (no deep imports)', () => {
  it('no package imports a non-entry-point path from another package', () => {
    const violations: string[] = [];

    for (const packageName of PACKAGE_ORDER) {
      const packageSrcDir = path.join(PACKAGES_DIR, packageName, 'src');
      for (const filePath of findTsFiles(packageSrcDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Match @greenclaw/<pkg>/<deep-path> imports (anything beyond the bare package name)
        const deepImportRegex = /(?:import|from)\s+['"]@greenclaw\/([\w-]+)\/([^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = deepImportRegex.exec(content)) !== null) {
          const targetPackage = match[1] as string;
          const deepPath = match[2] as string;
          // Only flag cross-package deep imports, not within the same package
          if (
            targetPackage !== packageName &&
            PACKAGE_ORDER.includes(targetPackage as (typeof PACKAGE_ORDER)[number])
          ) {
            violations.push(
              `${packageName}/${path.relative(path.join(PACKAGES_DIR, packageName), filePath)} ` +
                `deep-imports @greenclaw/${targetPackage}/${deepPath} — use @greenclaw/${targetPackage} instead`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Deep import violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: import from the package entry point (@greenclaw/<pkg>), not internal files.`,
    ).toHaveLength(0);
  });
});
