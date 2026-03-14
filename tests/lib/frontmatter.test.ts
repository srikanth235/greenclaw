import { describe, expect, it } from 'vitest';
import { PackageMetaSchema, parseFrontmatter } from './frontmatter';

/**
 * Unit tests for the YAML frontmatter parser and schema.
 */

describe('parseFrontmatter', () => {
  it('parses valid frontmatter with nested block', () => {
    const content = `---
package: api
layer: 4
tier: critical
grade: B
autonomy:
  bootable: true
  contract: true
  observable: true
  rollback_safe: true
---
# Title
Body text here.`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({
      package: 'api',
      layer: 4,
      tier: 'critical',
      grade: 'B',
      autonomy: {
        bootable: true,
        contract: true,
        observable: true,
        rollback_safe: true,
      },
    });
  });

  it('returns null when no frontmatter present', () => {
    const content = '# Title\nBody text.';
    expect(parseFrontmatter(content)).toBeNull();
  });

  it('coerces boolean and numeric values', () => {
    const content = `---
name: test
count: 42
enabled: false
---`;

    const result = parseFrontmatter(content);
    expect(result).toEqual({ name: 'test', count: 42, enabled: false });
  });
});

describe('PackageMetaSchema', () => {
  it('accepts valid metadata', () => {
    const valid = {
      package: 'api',
      layer: 4,
      tier: 'critical',
      grade: 'B',
      autonomy: {
        bootable: true,
        contract: true,
        observable: true,
        rollback_safe: true,
      },
    };
    expect(() => PackageMetaSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid tier', () => {
    const invalid = {
      package: 'api',
      layer: 4,
      tier: 'mega',
      grade: 'B',
      autonomy: { bootable: true, contract: true, observable: true, rollback_safe: true },
    };
    expect(() => PackageMetaSchema.parse(invalid)).toThrow();
  });

  it('rejects invalid grade', () => {
    const invalid = {
      package: 'api',
      layer: 4,
      tier: 'critical',
      grade: 'E',
      autonomy: { bootable: true, contract: true, observable: true, rollback_safe: true },
    };
    expect(() => PackageMetaSchema.parse(invalid)).toThrow();
  });

  it('rejects layer out of range', () => {
    const invalid = {
      package: 'api',
      layer: 6,
      tier: 'critical',
      grade: 'B',
      autonomy: { bootable: true, contract: true, observable: true, rollback_safe: true },
    };
    expect(() => PackageMetaSchema.parse(invalid)).toThrow();
  });
});
