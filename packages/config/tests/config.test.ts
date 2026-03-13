import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/index.js';

describe('config', () => {
  it('loads defaults when env vars are absent', () => {
    const config = loadConfig({});

    expect(config.telemetryDbPath).toBe('data/telemetry.db');
    expect(config.port).toBe(9090);
    expect(config.logLevel).toBe('info');
    expect(config.routingModels.SIMPLE.model).toBe('gpt-4o-mini');
  });

  it('honors explicit env overrides', () => {
    const config = loadConfig({
      GREENCLAW_TELEMETRY_DB: '/tmp/greenclaw.db',
      GREENCLAW_PORT: '8181',
      GREENCLAW_LOG_LEVEL: 'debug',
      GREENCLAW_UPSTREAM_BASE_URL: 'http://127.0.0.1:8080',
      GREENCLAW_COMPLEX_MODEL: 'gpt-4o',
    });

    expect(config.telemetryDbPath).toBe('/tmp/greenclaw.db');
    expect(config.port).toBe(8181);
    expect(config.logLevel).toBe('debug');
    expect(config.upstreamBaseUrl).toBe('http://127.0.0.1:8080');
    expect(config.routingModels.COMPLEX.model).toBe('gpt-4o');
  });
});
