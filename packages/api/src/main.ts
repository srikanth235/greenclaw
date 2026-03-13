/**
 * Runtime entrypoint for the GreenClaw proxy server.
 * @module @greenclaw/api/main
 */

import process from 'node:process';
import { loadConfig } from '@greenclaw/config';
import { createLogger } from '@greenclaw/telemetry';
import { startServer } from './server.js';

const VERSION = '0.1.0';
const HOSTNAME = '127.0.0.1';

/**
 * Start the GreenClaw proxy server using runtime configuration.
 * @returns Promise that resolves once signal handlers are installed
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel });
  const started = await startServer({
    hostname: HOSTNAME,
    port: config.port,
    dependencies: {
      config,
      logger,
      version: VERSION,
    },
  });

  logger.info(
    {
      hostname: HOSTNAME,
      port: started.port,
      version: VERSION,
    },
    'GreenClaw proxy started',
  );

  let closing = false;

  /**
   * Gracefully shut down the running server once.
   * @param signal - Signal name that initiated shutdown
   */
  const shutdown = async (signal: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, 'GreenClaw proxy shutting down');

    try {
      await started.close();
      process.exit(0);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          signal,
        },
        'GreenClaw proxy shutdown failed',
      );
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      message: 'GreenClaw proxy failed to start',
      error: message,
    })}\n`,
  );
  process.exit(1);
});
