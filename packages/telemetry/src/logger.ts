/**
 * Structured logger factory using Pino.
 * Produces JSON output to stdout matching the format defined in
 * `docs/conventions/observability.md`.
 * @module telemetry/logger
 */

import pino from 'pino';

/**
 * Options for creating a structured logger.
 */
export interface LoggerOptions {
  /** Minimum log level: 'debug' | 'info' | 'warn' | 'error' */
  level: string;
  /** Logger name (default: 'greenclaw') */
  name?: string;
  /** Optional destination stream for tests or embedding. */
  destination?: pino.DestinationStream;
}

/**
 * Create a structured Pino logger.
 * @param options - Logger configuration
 * @returns Configured Pino logger instance
 */
export function createLogger(options: LoggerOptions): pino.Logger {
  return pino(
    {
      level: options.level,
      messageKey: 'message',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      base: { name: options.name ?? 'greenclaw' },
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
    },
    options.destination,
  );
}
