import { PilotLocale, t } from "../i18n";

export type RunPreflightDeclineReason = "stage-declined" | "gate-declined" | "prod-denied";

export type RunPreflightResult =
  | { proceed: true }
  | { proceed: false; reason: RunPreflightDeclineReason };

export function formatRunNotStartedLines(
  locale: PilotLocale,
  reason: RunPreflightDeclineReason,
): string[] {
  const reasonKey =
    reason === "gate-declined"
      ? "log.runNotStartedGate"
      : reason === "prod-denied"
        ? "log.runNotStartedProd"
        : "log.runNotStartedStage";
  return [t(locale, "log.runNotStarted"), t(locale, reasonKey)];
}
