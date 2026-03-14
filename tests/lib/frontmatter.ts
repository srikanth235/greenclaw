import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

/**
 * Package metadata schema — validates YAML frontmatter in AGENTS.md files.
 *
 * This is the single source of truth for package layer, tier, grade, and
 * autonomy readiness. Markdown tables in QUALITY.md, CLAUDE.md, and
 * doc-governance.md are validated views of this data.
 */
export const PackageMetaSchema = z.object({
  package: z.string().min(1),
  layer: z.number().int().min(0).max(5),
  tier: z.enum(['critical', 'standard', 'low']),
  grade: z.enum(['A', 'B', 'C', 'D']),
  autonomy: z.object({
    bootable: z.boolean(),
    contract: z.boolean(),
    observable: z.boolean(),
    rollback_safe: z.boolean(),
  }),
});

/** Validated package metadata type. */
export type PackageMeta = z.infer<typeof PackageMetaSchema>;

const ROOT = path.resolve(__dirname, '../..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * Supports flat key-value pairs and one level of nesting (for the
 * `autonomy` block). Values are coerced: `true`/`false` → boolean,
 * numeric strings → number, everything else → string.
 *
 * @param content - Raw markdown file content
 * @returns Parsed key-value object, or null if no frontmatter found
 */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1] as string;
  const result: Record<string, unknown> = {};
  let currentNested: Record<string, unknown> | null = null;
  let currentKey: string | null = null;

  for (const line of yaml.split('\n')) {
    if (line.trim() === '') continue;

    // Nested key (indented with spaces)
    const nestedMatch = line.match(/^\s{2,}(\w+):\s*(.+)$/);
    if (nestedMatch && currentNested && currentKey) {
      currentNested[nestedMatch[1] as string] = coerce(nestedMatch[2] as string);
      continue;
    }

    // Top-level key that starts a nested block (value is empty)
    const blockMatch = line.match(/^(\w+):\s*$/);
    if (blockMatch) {
      currentKey = blockMatch[1] as string;
      currentNested = {};
      result[currentKey] = currentNested;
      continue;
    }

    // Top-level key-value
    const kvMatch = line.match(/^(\w+):\s*(.+)$/);
    if (kvMatch) {
      currentNested = null;
      currentKey = null;
      result[kvMatch[1] as string] = coerce(kvMatch[2] as string);
    }
  }

  return result;
}

/**
 * Coerce a YAML value string to its typed equivalent.
 * @param value - Raw string value
 * @returns Coerced value (boolean, number, or string)
 */
function coerce(value: string): boolean | number | string {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

/**
 * Load and validate frontmatter from all package AGENTS.md files.
 * @returns Map of package directory name → validated PackageMeta
 * @throws If any AGENTS.md is missing frontmatter or fails schema validation
 */
/**
 * Discover all package directories under packages/.
 * Uses the filesystem as the authoritative source — not frontmatter.
 * A directory counts as a package if it contains a `src/` subdirectory.
 * @returns Array of package directory names
 */
export function discoverPackageDirs(): string[] {
  if (!fs.existsSync(PACKAGES_DIR)) return [];

  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .filter((d) => fs.existsSync(path.join(PACKAGES_DIR, d.name, 'src')))
    .map((d) => d.name);
}

/**
 * Load and validate frontmatter from all package AGENTS.md files.
 *
 * Uses filesystem-discovered packages as the universe — a package
 * with missing AGENTS.md or broken/absent frontmatter throws an error
 * so it cannot silently disappear from test harnesses.
 *
 * @returns Map of package directory name → validated PackageMeta
 * @throws If any package lacks AGENTS.md or has missing/invalid frontmatter
 */
export function loadAllPackageMeta(): Map<string, PackageMeta> {
  const meta = new Map<string, PackageMeta>();
  const dirs = discoverPackageDirs();

  for (const dir of dirs) {
    const agentsPath = path.join(PACKAGES_DIR, dir, 'AGENTS.md');
    if (!fs.existsSync(agentsPath)) {
      throw new Error(
        `Package "${dir}" has no AGENTS.md. ` +
          `Every package must have an AGENTS.md with valid YAML frontmatter.`,
      );
    }

    const content = fs.readFileSync(agentsPath, 'utf-8');
    const raw = parseFrontmatter(content);
    if (!raw) {
      throw new Error(
        `Package "${dir}/AGENTS.md" has no YAML frontmatter (--- block). ` +
          `See docs/conventions/doc-governance.md for the required schema.`,
      );
    }

    const parsed = PackageMetaSchema.parse(raw);
    meta.set(dir, parsed);
  }

  return meta;
}

/**
 * Get package directory names sorted by layer (ascending).
 * @returns Array of package names
 */
export function getPackageNames(): string[] {
  const meta = loadAllPackageMeta();
  return [...meta.entries()].sort((a, b) => a[1].layer - b[1].layer).map(([name]) => name);
}

/**
 * Get packages in layer order for architecture dependency checks.
 * @returns Array of package names sorted by layer
 */
export function getPackageOrder(): string[] {
  return getPackageNames();
}

/**
 * Get packages belonging to a specific autonomy tier.
 * @param tier - The tier to filter by
 * @returns Array of package names in that tier
 */
export function getPackagesByTier(tier: 'critical' | 'standard' | 'low'): string[] {
  const meta = loadAllPackageMeta();
  return [...meta.entries()]
    .filter(([, m]) => m.tier === tier)
    .sort((a, b) => a[1].layer - b[1].layer)
    .map(([name]) => name);
}
