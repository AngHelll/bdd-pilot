import { PilotLocale, t } from "../i18n";

export type RunPreflightDeclineReason = "stage-declined" | "gate-declined";

export type RunPreflightResult =
  | { proceed: true }
  | { proceed: false; reason: RunPreflightDeclineReason };

export function formatRunNotStartedLines(
  locale: PilotLocale,
  reason: RunPreflightDeclineReason,
): string[] {
  const reasonKey =
    reason === "stage-declined" ? "log.runNotStartedStage" : "log.runNotStartedGate";
  return [t(locale, "log.runNotStarted"), t(locale, reasonKey)];
}
