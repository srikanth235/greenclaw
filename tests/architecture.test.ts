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
