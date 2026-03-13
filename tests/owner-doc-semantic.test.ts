import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const PACKAGES = [
  'types',
  'config',
  'telemetry',
  'optimization',
  'monitoring',
  'cli',
  'api',
  'dashboard',
] as const;
const ENABLED = process.env.GREENCLAW_ENABLE_LLM_HARNESS === '1';
const SHARED_CONTEXT_FILES = ['ARCHITECTURE.md', 'docs/conventions/testing.md'] as const;
const CODEX_MODEL = 'gpt-5';
const CODEX_REASONING_EFFORT = 'low';
const CODEX_TIMEOUT_MS = 180_000;

type PackageName = (typeof PACKAGES)[number];
type FindingCategory = 'ownership' | 'must_not' | 'invariant' | 'dependency';

interface SemanticFinding {
  category: FindingCategory;
  doc_claim: string;
  code_evidence: string;
  file: string;
  confidence: number;
}

interface SemanticVerdict {
  verdict: 'PASS' | 'FAIL';
  summary: string;
  findings: SemanticFinding[];
}

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'findings'],
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'doc_claim', 'code_evidence', 'file', 'confidence'],
        properties: {
          category: {
            type: 'string',
            enum: ['ownership', 'must_not', 'invariant', 'dependency'],
          },
          doc_claim: { type: 'string' },
          code_evidence: { type: 'string' },
          file: { type: 'string', pattern: '^packages/[^/]+/AGENTS\\.md$' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

function rel(filePath: string): string {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function collectFiles(dir: string, include: (entry: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, include));
      continue;
    }
    if (include(fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => rel(left).localeCompare(rel(right)));
}

function packageInputs(pkg: PackageName): string[] {
  const packageRoot = path.join(ROOT, 'packages', pkg);
  const packageFiles = [
    path.join(packageRoot, 'AGENTS.md'),
    path.join(packageRoot, 'package.json'),
    ...collectFiles(path.join(packageRoot, 'src'), (entry) => entry.endsWith('.ts')),
    ...collectFiles(path.join(packageRoot, 'tests'), (entry) => entry.endsWith('.test.ts')),
  ].filter((filePath) => fs.existsSync(filePath));

  const sharedFiles = SHARED_CONTEXT_FILES.map((filePath) => path.join(ROOT, filePath));
  return [...sharedFiles, ...packageFiles].sort((left, right) =>
    rel(left).localeCompare(rel(right)),
  );
}

function codeFence(filePath: string): string {
  if (filePath.endsWith('.md')) return 'md';
  if (filePath.endsWith('.json')) return 'json';
  return 'ts';
}

function renderFiles(files: string[]): string {
  return files
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      return `## FILE: ${rel(filePath)}\n\`\`\`${codeFence(filePath)}\n${content}\n\`\`\``;
    })
    .join('\n\n');
}

function buildPrompt(pkg: PackageName, files: string[]): string {
  return `You are the owner-doc semantic consistency harness for the GreenClaw repository.

Package under review: packages/${pkg}
Owner doc: packages/${pkg}/AGENTS.md

Task: determine whether the owner doc still truthfully describes package ownership,
prohibitions ("must NOT"), key invariants, and dependency boundaries.

Use only the repository files provided below. Do not use outside knowledge.

Fail only for:
- factual contradictions between the owner doc and code/tests/package metadata
- material omissions about the package main owned surface, prohibition, invariant, or dependency boundary

Do not fail for:
- writing style, tone, or formatting preferences
- minor internal helper omissions that do not change package ownership or behavior
- deferred work that is clearly described as deferred and matches the code

Every finding must cite a concrete repository file and conflicting behavior.
If the owner doc is semantically correct, return PASS with an empty findings array.
Return raw JSON only. No Markdown fences. No prose before or after the JSON.

JSON contract:
{
  "verdict": "PASS" | "FAIL",
  "summary": "one sentence",
  "findings": [
    {
      "category": "ownership" | "must_not" | "invariant" | "dependency",
      "doc_claim": "quoted or tightly paraphrased claim",
      "code_evidence": "specific file/path-based contradiction or omission",
      "file": "packages/<pkg>/AGENTS.md",
      "confidence": 0.0
    }
  ]
}

Included files (${files.length}):
${renderFiles(files)}`;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(`Could not find JSON object in Codex output:\n${raw}`);
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function parseVerdict(value: unknown): SemanticVerdict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Semantic harness response must be a JSON object.');
  }

  const verdict = value as Record<string, unknown>;
  if (verdict.verdict !== 'PASS' && verdict.verdict !== 'FAIL') {
    throw new Error(`Invalid verdict: ${String(verdict.verdict)}`);
  }
  if (typeof verdict.summary !== 'string' || verdict.summary.trim() === '') {
    throw new Error('Semantic harness response must include a non-empty summary.');
  }
  if (!Array.isArray(verdict.findings)) {
    throw new Error('Semantic harness response must include a findings array.');
  }

  const findings = verdict.findings.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      throw new Error(`Finding ${index} must be an object.`);
    }

    const item = finding as Record<string, unknown>;
    if (
      item.category !== 'ownership' &&
      item.category !== 'must_not' &&
      item.category !== 'invariant' &&
      item.category !== 'dependency'
    ) {
      throw new Error(`Finding ${index} has invalid category: ${String(item.category)}`);
    }
    if (typeof item.doc_claim !== 'string' || item.doc_claim.trim() === '') {
      throw new Error(`Finding ${index} must include a non-empty doc_claim.`);
    }
    if (typeof item.code_evidence !== 'string' || item.code_evidence.trim() === '') {
      throw new Error(`Finding ${index} must include concrete code_evidence.`);
    }
    if (typeof item.file !== 'string' || !/^packages\/[^/]+\/AGENTS\.md$/.test(item.file)) {
      throw new Error(`Finding ${index} has invalid file: ${String(item.file)}`);
    }
    if (
      typeof item.confidence !== 'number' ||
      !Number.isFinite(item.confidence) ||
      item.confidence < 0 ||
      item.confidence > 1
    ) {
      throw new Error(`Finding ${index} has invalid confidence: ${String(item.confidence)}`);
    }

    return item as SemanticFinding;
  });

  if (verdict.verdict === 'PASS' && findings.length > 0) {
    throw new Error('PASS verdict must not include findings.');
  }
  if (verdict.verdict === 'FAIL' && findings.length === 0) {
    throw new Error('FAIL verdict must include at least one finding.');
  }

  return {
    verdict: verdict.verdict,
    summary: verdict.summary,
    findings,
  };
}

function summarizeFailure(detail: string): string {
  const lines = detail
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return lines.slice(-20).join('\n');
}

function runSemanticCheck(pkg: PackageName): SemanticVerdict {
  const files = packageInputs(pkg);
  const prompt = buildPrompt(pkg, files);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `greenclaw-owner-doc-${pkg}-`));
  const schemaPath = path.join(tempDir, 'schema.json');
  const outputPath = path.join(tempDir, 'response.json');

  fs.writeFileSync(schemaPath, JSON.stringify(RESPONSE_SCHEMA, null, 2));

  try {
    try {
      execFileSync(
        'codex',
        [
          'exec',
          '-m',
          CODEX_MODEL,
          '-c',
          `model_reasoning_effort="${CODEX_REASONING_EFFORT}"`,
          '--sandbox',
          'read-only',
          '--cd',
          ROOT,
          '--ephemeral',
          '--color',
          'never',
          '--output-schema',
          schemaPath,
          '-o',
          outputPath,
          '-',
        ],
        {
          cwd: ROOT,
          encoding: 'utf-8',
          input: prompt,
          killSignal: 'SIGKILL',
          maxBuffer: 10 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: CODEX_TIMEOUT_MS,
        },
      );
    } catch (error) {
      const detail = summarizeFailure(
        error instanceof Error && 'stderr' in error && typeof error.stderr === 'string'
          ? error.stderr
          : error instanceof Error
            ? error.message
            : String(error),
      );
      throw new Error(
        `Codex semantic harness failed for packages/${pkg} using ${CODEX_MODEL} ` +
          `(${CODEX_REASONING_EFFORT} reasoning, timeout ${CODEX_TIMEOUT_MS}ms): ${detail}`,
      );
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Codex semantic harness produced no output file for packages/${pkg}.`);
    }

    const raw = fs.readFileSync(outputPath, 'utf-8');
    const parsed = JSON.parse(extractJson(raw)) as unknown;
    return parseVerdict(parsed);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function formatFindings(verdict: SemanticVerdict): string {
  if (verdict.findings.length === 0) {
    return verdict.summary;
  }

  return [
    verdict.summary,
    ...verdict.findings.map(
      (finding) =>
        `- [${finding.category}] ${finding.doc_claim} :: ${finding.code_evidence} (${finding.file}, confidence=${finding.confidence})`,
    ),
  ].join('\n');
}

if (!ENABLED) {
  describe.skip('Owner-doc semantic harness (set GREENCLAW_ENABLE_LLM_HARNESS=1 to enable)', () => {
    it('is opt-in by default', () => {});
  });
} else {
  describe('Owner-doc semantic harness', () => {
    beforeAll(() => {
      try {
        execFileSync('codex', ['--version'], {
          cwd: ROOT,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        throw new Error(
          'GREENCLAW_ENABLE_LLM_HARNESS=1 but the codex CLI is unavailable. Install Codex or disable the harness.',
        );
      }
    });

    for (const pkg of PACKAGES) {
      it(`packages/${pkg}/AGENTS.md matches package behavior`, () => {
        const verdict = runSemanticCheck(pkg);
        expect(
          verdict.verdict,
          `Owner-doc semantic drift detected for packages/${pkg}:\n${formatFindings(verdict)}`,
        ).toBe('PASS');
      }, 120_000);
    }
  });
}
