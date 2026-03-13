/**
 * Telemetry module — structured logging (Pino) and trace persistence (SQLite).
 * @module telemetry
 */

export { createLogger, type LoggerOptions } from './logger.js';
export { type FlatRow, traceToRow } from './row.js';
export { createStore } from './store.js';
export type {
  RequestTrace,
  TelemetryStats,
  TelemetryStore,
  TraceCost,
  TraceLatency,
  TraceTokens,
} from './types.js';
