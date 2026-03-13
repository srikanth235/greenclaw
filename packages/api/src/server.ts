/**
 * Server bootstrap helpers for GreenClaw.
 * @module @greenclaw/api/server
 */

import type { AddressInfo } from 'node:net';
import { type ServerType, serve } from '@hono/node-server';
import type { Hono } from 'hono';
import { type AppDependencies, createApp } from './app.js';

/** Running server handle returned by startServer(). */
export interface StartedServer {
  port: number;
  server: ServerType;
  close(): Promise<void>;
}

/**
 * Start a Hono app on a real TCP port for integration tests or local use.
 * @param options - App instance and listener options
 * @returns Running server handle with close()
 */
export function startServer(options?: {
  app?: Hono;
  port?: number;
  hostname?: string;
  dependencies?: Partial<AppDependencies>;
}): Promise<StartedServer> {
  return new Promise((resolve) => {
    const app = options?.app ?? createApp(options?.dependencies);
    const server = serve(
      {
        fetch: app.fetch,
        hostname: options?.hostname ?? '127.0.0.1',
        port: options?.port ?? 0,
      },
      (info: AddressInfo) => {
        resolve({
          port: info.port,
          server,
          close: () =>
            new Promise<void>((closeResolve, closeReject) => {
              server.close((error) => {
                if (error) {
                  closeReject(error);
                  return;
                }
                closeResolve();
              });
            }),
        });
      },
    );
  });
}
