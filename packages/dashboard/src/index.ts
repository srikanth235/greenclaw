/**
 * Dashboard package placeholder exports.
 * @module @greenclaw/dashboard
 */

/** Dashboard module status summary while UI work is deferred. */
export type DashboardStatus = {
  implemented: boolean;
  reason: string;
};

/**
 * Return the current dashboard implementation status.
 * @returns Dashboard status summary
 */
export function getDashboardStatus(): DashboardStatus {
  return {
    implemented: false,
    reason: 'TD-004 dashboard UI is deferred until the proxy and telemetry stack stabilize.',
  };
}
