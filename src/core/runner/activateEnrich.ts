/**
 * When to schedule Theory enrich after activate.
 * Returns delay ms, or undefined when no list-tests should be scheduled.
 */
export const ACTIVATE_ENRICH_IDLE_MS = 1000;

/** Debounce for feature-save enrich (v1.2.8). */
export const FEATURE_ENRICH_DEBOUNCE_MS = 2000;

export function activateEnrichDelayMs(needsDiscovery: boolean): number | undefined {
  return needsDiscovery ? ACTIVATE_ENRICH_IDLE_MS : undefined;
}
