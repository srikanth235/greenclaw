import * as fs from 'node:fs';
import * as path from 'node:path';

/** A parsed markdown table row, keyed by normalized column headers. */
export type TableRow = Record<string, string>;

/**
 * Parse a markdown table into typed row objects.
 *
 * The first pipe-delimited line is treated as the header row. The second
 * line (separator) is skipped. Remaining lines become row objects keyed
 * by normalized header names (trimmed, lowercased, spaces → underscores).
 *
 * @param section - Markdown content containing a table
 * @returns Array of row objects
 */
export function parseMarkdownTable(section: string): TableRow[] {
  const lines = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));

  if (lines.length < 2) return [];

  // Header row
  const headers = splitRow(lines[0] as string).map(normalizeHeader);

  // Skip separator row (index 1)
  const rows: TableRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = splitRow(lines[i] as string);
    const row: TableRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j] as string] = (cells[j] ?? '').trim();
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Split a pipe-delimited row into cell values.
 * @param line - A line like `| a | b | c |`
 * @returns Array of trimmed cell strings
 */
function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Normalize a header string for use as an object key.
 * @param header - Raw header text
 * @returns Lowercase, spaces replaced with underscores, trimmed
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[- ]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Extract a section from markdown content between a heading and the next
 * same-or-higher-level heading (or EOF).
 * @param content - Full markdown content
 * @param headingPattern - Regex to match the section heading
 * @returns The section content (excluding the heading line), or null
 */
export function extractSection(content: string, headingPattern: RegExp): string | null {
  const lines = content.split('\n');
  let startIdx = -1;
  let headingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1) {
      if (headingPattern.test(lines[i] as string)) {
        startIdx = i + 1;
        const match = (lines[i] as string).match(/^(#+)/);
        headingLevel = match ? (match[1] as string).length : 0;
      }
    } else if (headingLevel > 0) {
      const match = (lines[i] as string).match(/^(#+)\s/);
      if (match && (match[1] as string).length <= headingLevel) {
        return lines.slice(startIdx, i).join('\n');
      }
    }
  }

  if (startIdx === -1) return null;
  return lines.slice(startIdx).join('\n');
}

/**
 * Read a markdown file and strip its YAML frontmatter block.
 * @param filePath - Absolute path to the file
 * @returns File content with frontmatter removed
 */
export function readWithoutFrontmatter(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

const ROOT = path.resolve(__dirname, '../..');

/**
 * Resolve a doc path relative to the repository root.
 * @param relPath - Relative path from root
 * @returns Absolute path
 */
export function docPath(relPath: string): string {
  return path.join(ROOT, relPath);
}
