/**
 * Configuration module — centralized environment variable access.
 * @module @greenclaw/config
 */

/**
 * Resolved configuration for GreenClaw.
 */
export interface GreenClawConfig {
  /** Path to the SQLite telemetry database. */
  telemetryDbPath: string;
}

/**
 * Load configuration from environment variables with defaults.
 * @returns Resolved configuration object
 */
export function loadConfig(): GreenClawConfig {
  return {
    telemetryDbPath: process.env.GREENCLAW_TELEMETRY_DB ?? 'data/telemetry.db',
  };
}

// TODO: Provider registry, model-to-tier mapping, token thresholds
