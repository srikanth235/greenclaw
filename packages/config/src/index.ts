/**
 * Configuration module — centralized environment variable access.
 * @module @greenclaw/config
 */

import { ProviderModelSchema } from '@greenclaw/types';
import { z } from 'zod';

/** Supported log levels for the structured logger. */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
/** Supported log levels for the structured logger. */
export type LogLevel = z.infer<typeof LogLevelSchema>;

/** Runtime configuration schema for GreenClaw. */
export const GreenClawConfigSchema = z.object({
  telemetryDbPath: z.string(),
  port: z.number().int().min(0),
  logLevel: LogLevelSchema,
  upstreamBaseUrl: z.string().url(),
  routingModels: z.object({
    HEARTBEAT: ProviderModelSchema,
    SIMPLE: ProviderModelSchema,
    MODERATE: ProviderModelSchema,
    COMPLEX: ProviderModelSchema,
  }),
});

/**
 * Resolved configuration for GreenClaw.
 */
export type GreenClawConfig = z.infer<typeof GreenClawConfigSchema>;

/**
 * Recursively freeze a config object so runtime callers cannot mutate it.
 * @param value - Object to freeze
 * @returns Deep-frozen object
 */
function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

/**
 * Load configuration from environment variables with defaults.
 * @param env - Environment variable bag to resolve
 * @returns Resolved configuration object
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): GreenClawConfig {
  return deepFreeze(
    GreenClawConfigSchema.parse({
      telemetryDbPath: env.GREENCLAW_TELEMETRY_DB ?? 'data/telemetry.db',
      port: Number(env.GREENCLAW_PORT ?? '9090'),
      logLevel: env.GREENCLAW_LOG_LEVEL ?? 'info',
      upstreamBaseUrl: env.GREENCLAW_UPSTREAM_BASE_URL ?? 'http://127.0.0.1:4000',
      routingModels: {
        HEARTBEAT: {
          provider: env.GREENCLAW_HEARTBEAT_PROVIDER ?? 'openai',
          model: env.GREENCLAW_HEARTBEAT_MODEL ?? 'gpt-4o-mini',
        },
        SIMPLE: {
          provider: env.GREENCLAW_SIMPLE_PROVIDER ?? 'openai',
          model: env.GREENCLAW_SIMPLE_MODEL ?? 'gpt-4o-mini',
        },
        MODERATE: {
          provider: env.GREENCLAW_MODERATE_PROVIDER ?? 'openai',
          model: env.GREENCLAW_MODERATE_MODEL ?? 'gpt-4o',
        },
        COMPLEX: {
          provider: env.GREENCLAW_COMPLEX_PROVIDER ?? 'openai',
          model: env.GREENCLAW_COMPLEX_MODEL ?? 'gpt-4.1',
        },
      },
    }),
  );
}
