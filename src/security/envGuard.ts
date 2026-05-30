import { Stage } from "../core/config/types";
import { envGuardMessageKey } from "../core/i18n";

export interface GuardDecision {
  /** Whether confirmation is required before running. */
  requiresConfirmation: boolean;
  /** Severity used to pick the right UI prompt (modal warning vs info). */
  severity: "info" | "warning";
  /** i18n key for the confirmation message when requiresConfirmation is true. */
  messageKey?: ReturnType<typeof envGuardMessageKey>;
}

/**
 * Pure policy that decides whether running against a given stage needs explicit
 * user confirmation. UI (modal dialog) lives in the extension layer; this stays
 * testable and free of the VS Code API.
 */
export function evaluateRun(
  stage: Stage,
  requireConfirmationForStages: Stage[],
): GuardDecision {
  const protectedStages = new Set(requireConfirmationForStages);
  if (!protectedStages.has(stage)) {
    return {
      requiresConfirmation: false,
      severity: "info",
    };
  }

  return {
    requiresConfirmation: true,
    severity: "warning",
    messageKey: envGuardMessageKey(stage),
  };
}
