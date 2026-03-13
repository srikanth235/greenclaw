import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classify } from '../packages/optimization/src/classifier/index.js';

/**
 * Classifier fixture test with eval scoring.
 *
 * Loads tests/fixtures/requests.json (50 labeled samples) and asserts
 * the classifier achieves ≥90% accuracy. Emits a structured eval report
 * to stdout for tracking classifier quality over time.
 *
 * Currently skipped because the classifier is a stub.
 */

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures', 'requests.json');
const ACCURACY_THRESHOLD = 0.9;

const TIERS = ['HEARTBEAT', 'SIMPLE', 'MODERATE', 'COMPLEX'] as const;
type Tier = (typeof TIERS)[number];

interface FixtureSample {
  id?: string;
  messages: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
  }>;
  model: string;
  expected_tier: Tier;
}

interface EvalReport {
  timestamp: string;
  total_samples: number;
  accuracy: number;
  threshold: number;
  passed: boolean;
  per_tier: Record<string, { total: number; correct: number; accuracy: number }>;
  confusion: Record<string, Record<string, number>>;
  misclassified: Array<{ sample_index: number; sample_id: string; expected: string; got: string }>;
}

/**
 * Build a structured eval report from classification results.
 * @param samples - The fixture samples
 * @param results - The classification results in the same order
 * @returns A structured eval report
 */
function buildEvalReport(samples: FixtureSample[], results: Tier[]): EvalReport {
  const perTier: EvalReport['per_tier'] = {};
  const confusion: EvalReport['confusion'] = {};
  const misclassified: EvalReport['misclassified'] = [];

  for (const tier of TIERS) {
    perTier[tier] = { total: 0, correct: 0, accuracy: 0 };
    confusion[tier] = {};
    for (const t of TIERS) {
      confusion[tier][t] = 0;
    }
  }

  let correct = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] as (typeof samples)[number];
    const result = results[i] as string;
    const expected = sample.expected_tier;

    (perTier[expected] as { total: number; correct: number; accuracy: number }).total++;
    (confusion[expected] as Record<string, number>)[result]++;

    if (result === expected) {
      correct++;
      (perTier[expected] as { total: number; correct: number; accuracy: number }).correct++;
    } else {
      misclassified.push({
        sample_index: i,
        sample_id: sample.id ?? `sample-${i}`,
        expected,
        got: result,
      });
    }
  }

  for (const tier of TIERS) {
    const t = perTier[tier] as { total: number; correct: number; accuracy: number };
    t.accuracy = t.total > 0 ? t.correct / t.total : 0;
  }

  const accuracy = correct / samples.length;

  return {
    timestamp: new Date().toISOString(),
    total_samples: samples.length,
    accuracy,
    threshold: ACCURACY_THRESHOLD,
    passed: accuracy >= ACCURACY_THRESHOLD,
    per_tier: perTier,
    confusion,
    misclassified,
  };
}

describe('Classifier: Fixture Accuracy', () => {
  it('achieves ≥90% accuracy on the fixture', () => {
    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const samples: FixtureSample[] = JSON.parse(raw);

    expect(samples).toHaveLength(50);

    const results: Tier[] = samples.map((sample) => {
      return classify(sample.messages, sample.model);
    });

    // Build and emit structured eval report
    const report = buildEvalReport(samples, results);

    // Emit report as structured JSON for eval tracking
    console.log('\n=== CLASSIFIER EVAL REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    console.log('=== END EVAL REPORT ===\n');

    // Per-tier breakdown for quick scan
    for (const tier of TIERS) {
      const t = report.per_tier[tier] as { total: number; correct: number; accuracy: number };
      console.log(
        `  ${tier.padEnd(10)} ${t.correct}/${t.total} (${(t.accuracy * 100).toFixed(0)}%)`,
      );
    }

    if (report.misclassified.length > 0) {
      console.log(`\nMisclassified (${report.misclassified.length}):`);
      for (const m of report.misclassified) {
        console.log(`  [${m.sample_id}] expected ${m.expected}, got ${m.got}`);
      }
    }

    expect(
      report.accuracy,
      `Classifier accuracy ${(report.accuracy * 100).toFixed(1)}% is below ` +
        `the ${ACCURACY_THRESHOLD * 100}% threshold`,
    ).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);

    expect(report.passed).toBe(true);
  });
});
