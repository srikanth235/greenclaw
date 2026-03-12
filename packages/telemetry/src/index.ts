/**
 * Telemetry module — structured logging (Pino) and trace persistence (SQLite).
 * @module telemetry
 */

export { createLogger, type LoggerOptions } from './logger.js';
export { createStore } from './store.js';
export type {
  TelemetryStore,
  TelemetryStats,
  RequestTrace,
  TraceTokens,
  TraceCost,
  TraceLatency,
} from './types.js';
