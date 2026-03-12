import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Dependency layer enforcement.
 *
 * Layer order (lowest to highest):
 *   types → config → classifier → compactor → router → api → dashboard
 *
 * A module may only import from modules at the same or lower layer.
 */

const LAYER_ORDER = [
  'types',
  'config',
  'classifier',
  'compactor',
  'router',
  'api',
  'dashboard',
] as const;

const SRC_DIR = path.resolve(__dirname, '..', 'src');

/**
 * Get the layer index for a given module name.
 * @param moduleName - The module directory name
 * @returns The layer index, or -1 if not found
 */
function getLayerIndex(moduleName: string): number {
  return LAYER_ORDER.indexOf(moduleName as (typeof LAYER_ORDER)[number]);
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
 * Extract local src/ module imports from a TypeScript file.
 * Matches patterns like:
 *   import { foo } from '../types/index.js';
 *   import * as bar from '../config/index.js';
 * @param filePath - Absolute path to the .ts file
 * @returns Array of module names imported (e.g., ['types', 'config'])
 */
function extractModuleImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /(?:import|from)\s+['"]\.\.?\/([\w-]+)(?:\/[^'"]*)?['"]/g;
  const modules: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const moduleName = match[1];
    if (
      moduleName !== undefined &&
      LAYER_ORDER.includes(moduleName as (typeof LAYER_ORDER)[number])
    ) {
      modules.push(moduleName);
    }
  }

  return [...new Set(modules)];
}

describe('Architecture: Layer Dependency Enforcement', () => {
  // Skip until modules have real code — stubs have no imports to validate
  it.skip('no module imports from a higher layer', () => {
    for (const moduleName of LAYER_ORDER) {
      const moduleDir = path.join(SRC_DIR, moduleName);
      const moduleLayer = getLayerIndex(moduleName);
      const tsFiles = findTsFiles(moduleDir);

      for (const filePath of tsFiles) {
        const imports = extractModuleImports(filePath);
        for (const importedModule of imports) {
          const importedLayer = getLayerIndex(importedModule);
          expect(
            importedLayer,
            `${moduleName}/ imports from ${importedModule}/ — layer violation! ` +
              `${moduleName} (layer ${moduleLayer}) cannot import from ` +
              `${importedModule} (layer ${importedLayer}). ` +
              `File: ${path.relative(SRC_DIR, filePath)}`,
          ).toBeLessThanOrEqual(moduleLayer);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Pure function layers — classifier, compactor, and router must never import
// I/O primitives. They are pure pipeline stages (ADR-001).
// ---------------------------------------------------------------------------

describe('Architecture: Pure Function Layers', () => {
  /** Modules that must remain free of I/O imports. */
  const PURE_MODULES = ['classifier', 'compactor', 'router'] as const;

  /**
   * Patterns that indicate I/O or side-effect imports.
   * Matches common Node built-ins and fetch.
   */
  const IO_PATTERNS = [
    /\bimport\b.*['"]node:(?:fs|http|https|net|dgram|child_process|cluster|tls|dns)['"]/,
    /\bimport\b.*['"](?:fs|http|https|net|node-fetch)['"]/,
    /\brequire\s*\(\s*['"](?:node:)?(?:fs|http|https|net|child_process)['"]\s*\)/,
  ];

  it('pure pipeline modules do not import I/O primitives', () => {
    const violations: string[] = [];

    for (const mod of PURE_MODULES) {
      const moduleDir = path.join(SRC_DIR, mod);
      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const pattern of IO_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(
              `${path.relative(SRC_DIR, filePath)} imports I/O module (matched ${pattern.source})`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Pure-function layer violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: classifier/, compactor/, and router/ must not import fs, http, ` +
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

    for (const mod of PURE_MODULES) {
      const moduleDir = path.join(SRC_DIR, mod);
      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i]!.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }
          for (const { pattern, label } of SIDE_EFFECT_PATTERNS) {
            if (pattern.test(trimmed)) {
              violations.push(
                `${path.relative(SRC_DIR, filePath)}:${i + 1} uses ${label} — ` +
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

    for (const mod of PURE_MODULES) {
      const moduleDir = path.join(SRC_DIR, mod);
      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }
          if (/\bfetch\s*\(/.test(trimmed)) {
            violations.push(
              `${path.relative(SRC_DIR, filePath)} uses fetch() — pure modules must not make network calls`,
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
   * Build an adjacency map of module → modules it imports.
   * @returns Map from module name to set of imported module names
   */
  function buildImportGraph(): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();

    for (const moduleName of LAYER_ORDER) {
      const moduleDir = path.join(SRC_DIR, moduleName);
      const imports = new Set<string>();

      for (const filePath of findTsFiles(moduleDir)) {
        for (const imported of extractModuleImports(filePath)) {
          if (imported !== moduleName) {
            imports.add(imported);
          }
        }
      }

      graph.set(moduleName, imports);
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

  it('no circular dependencies exist between modules', () => {
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
// Re-export hygiene — modules must only be imported via their index.ts entry
// point. No deep imports into internal files from outside the module.
// ---------------------------------------------------------------------------

describe('Architecture: Re-export Hygiene (no deep imports)', () => {
  it('no module imports a non-index file from another module', () => {
    const violations: string[] = [];

    for (const moduleName of LAYER_ORDER) {
      const moduleDir = path.join(SRC_DIR, moduleName);
      for (const filePath of findTsFiles(moduleDir)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Regex is created per-file to avoid stale lastIndex from the g flag
        const deepImportRegex = /(?:import|from)\s+['"]\.\.?\/([\w-]+)\/((?!index)[^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = deepImportRegex.exec(content)) !== null) {
          const targetModule = match[1]!;
          const deepPath = match[2]!;
          // Only flag cross-module deep imports, not within the same module
          if (
            targetModule !== moduleName &&
            LAYER_ORDER.includes(targetModule as (typeof LAYER_ORDER)[number])
          ) {
            violations.push(
              `${moduleName}/${path.relative(path.join(SRC_DIR, moduleName), filePath)} ` +
                `deep-imports ${targetModule}/${deepPath} — use ${targetModule}/index.ts instead`,
            );
          }
        }
      }
    }

    expect(
      violations,
      `Deep import violations:\n  ${violations.join('\n  ')}\n` +
        `Fix: import from the module's index.ts entry point, not internal files.`,
    ).toHaveLength(0);
  });
});
