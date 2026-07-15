import { Stage } from "../core/config/types";
import { envGuardMessageKey } from "../core/i18n";

export type EnvGuardMessageKey =
  | ReturnType<typeof envGuardMessageKey>
  | "envGuard.prodBlocked";

export interface EvaluateRunOptions {
  /**
   * When false, `prod` runs are denied (no confirmation dialog).
   * Omitted defaults to **true** so legacy callers only exercise confirmation policy.
   * Settings default is false — runners must pass `settings.allowProductionRuns`.
   */
  allowProductionRuns?: boolean;
}

export interface GuardDecision {
  /** When true, the run must not proceed (no confirmation UI). */
  denied: boolean;
  /** Whether confirmation is required before running. */
  requiresConfirmation: boolean;
  /** Severity used to pick the right UI prompt (modal warning vs info). */
  severity: "info" | "warning";
  /** i18n key for deny toast or confirmation message. */
  messageKey?: EnvGuardMessageKey;
}

/**
 * Pure policy for stage confirmation and production opt-in.
 * UI (modal / toast) lives in the extension layer.
 */
export function evaluateRun(
  stage: Stage,
  requireConfirmationForStages: Stage[],
  options: EvaluateRunOptions = {},
): GuardDecision {
  const allowProductionRuns = options.allowProductionRuns !== false;

  if (stage === "prod" && !allowProductionRuns) {
    return {
      denied: true,
      requiresConfirmation: false,
      severity: "warning",
      messageKey: "envGuard.prodBlocked",
    };
  }

  const protectedStages = new Set(requireConfirmationForStages);
  if (!protectedStages.has(stage)) {
    return {
      denied: false,
      requiresConfirmation: false,
      severity: "info",
    };
  }

  return {
    denied: false,
    requiresConfirmation: true,
    severity: "warning",
    messageKey: envGuardMessageKey(stage),
  };
}
