import { describe, expect, it } from 'vitest';
import { getDashboardStatus } from '../src/index.js';

describe('dashboard', () => {
  it('exposes the current placeholder status', () => {
    expect(getDashboardStatus()).toEqual({
      implemented: false,
      reason: 'TD-004 dashboard UI is deferred until the proxy and telemetry stack stabilize.',
    });
  });
});
