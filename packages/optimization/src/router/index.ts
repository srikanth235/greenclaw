/**
 * Model router for GreenClaw.
 * @module @greenclaw/optimization/router
 */

import type { GreenClawConfig } from '@greenclaw/config';
import type { ProviderModel, TaskTier } from '@greenclaw/types';

/**
 * Determine whether the request should be auto-routed.
 * @param model - Requested model name
 * @returns True when GreenClaw should replace the model
 */
export function shouldAutoRoute(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized === 'auto' || normalized === 'greenclaw/auto';
}

/**
 * Select the routed provider/model for a request.
 * @param tier - Classified task tier
 * @param config - Resolved runtime config
 * @param requestedModel - Model from the inbound request
 * @returns Provider/model pair to forward upstream
 */
export function route(
  tier: TaskTier,
  config: GreenClawConfig,
  requestedModel: string,
): ProviderModel {
  if (!shouldAutoRoute(requestedModel)) {
    return {
      provider: config.routingModels.COMPLEX.provider,
      model: requestedModel,
    };
  }

  return config.routingModels[tier];
}
