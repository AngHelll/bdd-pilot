import { Stage } from "../core/config/types";

export interface GuardDecision {
  /** Whether confirmation is required before running. */
  requiresConfirmation: boolean;
  /** Severity used to pick the right UI prompt (modal warning vs info). */
  severity: "info" | "warning";
  message: string;
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
      message: `Running tests against '${stage}'.`,
    };
  }

  const severity: GuardDecision["severity"] = stage === "prod" ? "warning" : "warning";
  const message =
    stage === "prod"
      ? "You are about to run tests against PRODUCTION. This may affect live data and trigger external reporting. Continue?"
      : `You are about to run tests against '${stage}', which reports to X-Ray. Continue?`;

  return { requiresConfirmation: true, severity, message };
}
