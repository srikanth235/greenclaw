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

// ---------------------------------------------------------------------------
// YAML frontmatter parser
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a markdown string.
 *
 * Supports:
 * - Flat key-value pairs: `key: value`
 * - Nested blocks (2-space indent): `parent:\n  child: value`
 * - Two-level nesting: `grandparent:\n  parent:\n    child: value`
 * - Inline flow maps: `key: { a: 1, b: 2 }`
 * - Inline flow arrays: `key: [a, b, c]`
 * - Array items with inline maps: `- { id: X, name: Y }`
 * - Quoted strings: `key: "value"`
 *
 * Values are coerced: `true`/`false` → boolean, numeric → number.
 *
 * @param content - Raw markdown file content
 * @returns Parsed key-value object, or null if no frontmatter found
 */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1] as string;
  return parseYamlBlock(yaml);
}

/**
 * Parse a block of simple YAML into a nested object.
 * @param yaml - YAML text (no `---` delimiters)
 * @returns Parsed object
 */
function parseYamlBlock(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() === '') {
      i++;
      continue;
    }

    const indent = getIndent(line);
    if (indent > 0) {
      // Skip lines that belong to a parent block (handled by collectBlock)
      i++;
      continue;
    }

    // Array item at top level
    if (line.trimStart().startsWith('- ')) {
      // Shouldn't happen at top level in our usage, skip
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const valueStr = line.slice(colonIdx + 1).trim();

    if (valueStr === '') {
      // Block value — collect indented children
      const block = collectBlock(lines, i + 1, indent + 2);
      result[key] = parseBlockValue(block.lines);
      i = block.endIdx;
    } else {
      result[key] = parseInlineValue(valueStr);
      i++;
    }
  }

  return result;
}

/**
 * Collect all lines at a given indent level or deeper.
 * @param lines - All YAML lines
 * @param startIdx - Index to start collecting from
 * @param minIndent - Minimum indent to include
 * @returns Collected lines and the index after the block
 */
function collectBlock(
  lines: string[],
  startIdx: number,
  minIndent: number,
): { lines: string[]; endIdx: number } {
  const collected: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (getIndent(line) < minIndent) break;
    collected.push(line);
    i++;
  }
  return { lines: collected, endIdx: i };
}

/**
 * Parse collected block lines into a value (object, array, or nested structure).
 * @param lines - Indented YAML lines
 * @returns Parsed value
 */
function parseBlockValue(lines: string[]): unknown {
  if (lines.length === 0) return {};

  // Check if it's an array (first line starts with `- `)
  if ((lines[0] as string).trimStart().startsWith('- ')) {
    return parseArrayBlock(lines);
  }

  // It's a map — parse key-value pairs
  const baseIndent = getIndent(lines[0] as string);
  const result: Record<string, unknown> = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    if (line.trim() === '' || getIndent(line) < baseIndent) {
      i++;
      continue;
    }

    // Skip lines deeper than base (handled by sub-block collection)
    if (getIndent(line) > baseIndent) {
      i++;
      continue;
    }

    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const valueStr = trimmed.slice(colonIdx + 1).trim();

    if (valueStr === '') {
      // Sub-block
      const block = collectBlock(lines, i + 1, getIndent(line) + 2);
      result[key] = parseBlockValue(block.lines);
      i = block.endIdx;
    } else {
      result[key] = parseInlineValue(valueStr);
      i++;
    }
  }

  return result;
}

/**
 * Parse array block lines (lines starting with `- `).
 * @param lines - Array item lines
 * @returns Parsed array
 */
function parseArrayBlock(lines: string[]): unknown[] {
  const result: unknown[] = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('- ')) continue;
    const itemValue = trimmed.slice(2).trim();
    result.push(parseInlineValue(itemValue));
  }
  return result;
}

/**
 * Parse an inline YAML value (flow map, flow array, or scalar).
 * @param value - Trimmed value string
 * @returns Parsed value
 */
function parseInlineValue(value: string): unknown {
  // Flow map: { a: 1, b: 2 }
  if (value.startsWith('{') && value.endsWith('}')) {
    return parseFlowMap(value.slice(1, -1));
  }

  // Flow array: [a, b, c]
  if (value.startsWith('[') && value.endsWith(']')) {
    return parseFlowArray(value.slice(1, -1));
  }

  return coerce(value);
}

/**
 * Parse a YAML flow map string (contents between `{` and `}`).
 * @param inner - e.g. `a: 1, b: true`
 * @returns Parsed object
 */
function parseFlowMap(inner: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Split on commas, but not within quotes
  const pairs = smartSplit(inner, ',');
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const val = pair.slice(colonIdx + 1).trim();
    result[key] = coerce(val);
  }
  return result;
}

/**
 * Parse a YAML flow array string (contents between `[` and `]`).
 * @param inner - e.g. `a, b, c`
 * @returns Parsed array
 */
function parseFlowArray(inner: string): unknown[] {
  return smartSplit(inner, ',').map((s) => coerce(s.trim()));
}

/**
 * Split a string by a delimiter, respecting quotes.
 * @param str - Input string
 * @param delimiter - Character to split on
 * @returns Array of parts
 */
function smartSplit(str: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of str) {
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === delimiter) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Get the indentation level (number of leading spaces) of a line.
 * @param line - Input line
 * @returns Number of leading spaces
 */
function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? (match[1] as string).length : 0;
}

/**
 * Coerce a YAML value string to its typed equivalent.
 * @param value - Raw string value
 * @returns Coerced value (boolean, number, or string)
 */
function coerce(value: string): boolean | number | string {
  let trimmed = value.trim();
  // Strip quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Package metadata loaders (AGENTS.md)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// QUALITY.md frontmatter loader (PLAN-014)
// ---------------------------------------------------------------------------

/** Per-package quality grade from QUALITY.md frontmatter. */
const QualityPackageSchema = z.object({
  grade: z.enum(['A', 'B', 'C', 'D']),
});

/** Per-package autonomy readiness from QUALITY.md frontmatter. */
const AutonomySchema = z.object({
  bootable: z.boolean(),
  contract: z.boolean(),
  observable: z.boolean(),
  rollback_safe: z.boolean(),
});

/** Full QUALITY.md frontmatter schema. */
export const QualityMetaSchema = z.object({
  packages: z.record(z.string(), QualityPackageSchema),
  autonomy: z.record(z.string(), AutonomySchema),
});

/** Validated QUALITY.md frontmatter type. */
export type QualityMeta = z.infer<typeof QualityMetaSchema>;

/**
 * Load and validate QUALITY.md YAML frontmatter.
 * @returns Validated quality metadata
 * @throws If frontmatter is missing or invalid
 */
export function loadQualityMeta(): QualityMeta {
  const filePath = path.join(ROOT, 'docs', 'QUALITY.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseFrontmatter(content);
  if (!raw) {
    throw new Error('docs/QUALITY.md has no YAML frontmatter.');
  }
  return QualityMetaSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// tech-debt-tracker.md frontmatter loader (PLAN-014)
// ---------------------------------------------------------------------------

/** Active tech debt item. */
const ActiveDebtSchema = z.object({
  id: z.string(),
  module: z.string(),
  priority: z.string(),
  status: z.string(),
});

/** Resolved tech debt item. */
const ResolvedDebtSchema = z.object({
  id: z.string(),
  resolved: z.string(),
});

/** Full tech-debt-tracker.md frontmatter schema. */
export const TechDebtMetaSchema = z.object({
  active: z.array(ActiveDebtSchema),
  resolved: z.array(ResolvedDebtSchema),
});

/** Validated tech-debt-tracker.md frontmatter type. */
export type TechDebtMeta = z.infer<typeof TechDebtMetaSchema>;

/**
 * Load and validate tech-debt-tracker.md YAML frontmatter.
 * @returns Validated tech debt metadata
 * @throws If frontmatter is missing or invalid
 */
export function loadTechDebtMeta(): TechDebtMeta {
  const filePath = path.join(ROOT, 'docs', 'exec-plans', 'tech-debt-tracker.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseFrontmatter(content);
  if (!raw) {
    throw new Error('docs/exec-plans/tech-debt-tracker.md has no YAML frontmatter.');
  }
  return TechDebtMetaSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// doc-governance.md frontmatter loader (PLAN-014)
// ---------------------------------------------------------------------------

/** doc-governance.md tier mapping. */
export const DocGovernanceTiersSchema = z.object({
  tiers: z.object({
    critical: z.array(z.string()),
    standard: z.array(z.string()),
    low: z.array(z.string()),
  }),
});

/** Validated doc-governance.md frontmatter type. */
export type DocGovernanceTiers = z.infer<typeof DocGovernanceTiersSchema>;

/**
 * Load and validate doc-governance.md YAML frontmatter (tiers).
 * @returns Validated tier metadata
 * @throws If frontmatter is missing or invalid
 */
export function loadDocGovernanceTiers(): DocGovernanceTiers {
  const filePath = path.join(ROOT, 'docs', 'conventions', 'doc-governance.md');
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseFrontmatter(content);
  if (!raw) {
    throw new Error('docs/conventions/doc-governance.md has no YAML frontmatter.');
  }
  return DocGovernanceTiersSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Section-to-class mapping (PLAN-015)
// ---------------------------------------------------------------------------

/** Mutation classes for document governance. */
const MutationClassEnum = z.enum([
  'ledger',
  'state',
  'decision',
  'index',
  'owner-map',
  'reference',
]);

/** A single section-to-class mapping entry. */
export const SectionClassSchema = z.object({
  heading: z.string().min(1),
  class: MutationClassEnum,
});

/** Validated section-class entry type. */
export type SectionClass = z.infer<typeof SectionClassSchema>;

/**
 * Load section-to-class mappings from a document's YAML frontmatter.
 * @param filePath - Absolute path to the markdown file
 * @returns Array of section-class mappings, or empty array if no `sections` key
 * @throws If frontmatter is missing or `sections` entries are invalid
 */
export function loadSectionClasses(filePath: string): SectionClass[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = parseFrontmatter(content);
  if (!raw || !raw.sections) return [];
  const sections = raw.sections;
  if (!Array.isArray(sections)) {
    throw new Error(`${filePath}: "sections" frontmatter must be an array.`);
  }
  return sections.map((entry, i) => {
    const result = SectionClassSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(`${filePath}: sections[${i}] is invalid: ${result.error.message}`);
    }
    return result.data;
  });
}
