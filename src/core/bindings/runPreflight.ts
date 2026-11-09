import { PilotLocale, t } from "../i18n";

export type RunPreflightDeclineReason = "stage-declined" | "gate-declined" | "prod-denied";

export type RunNotStartedReason =
  | RunPreflightDeclineReason
  | "empty-scope"
  | "unresolved-target"
  | "outputs-missing";

export interface RunNotStartedNotice {
  reason: RunNotStartedReason;
  /** Unbound steps just shown. Omitted when the count is unknown. */
  unboundCount?: number;
}

export type RunPreflightResult =
  | { proceed: true }
  | { proceed: false; reason: RunPreflightDeclineReason; unboundCount?: number };

/** One-line summary label and warning. Detail stays in the terminal. */
export function formatRunNotStartedNotice(
  locale: PilotLocale,
  notice: RunNotStartedNotice,
): string {
  switch (notice.reason) {
    case "gate-declined":
      if (notice.unboundCount !== undefined) {
        return t(locale, "runNotStarted.gate", { count: notice.unboundCount });
      }
      return t(locale, "runNotStarted.gateNoCount");
    case "stage-declined":
      return t(locale, "runNotStarted.stage");
    case "prod-denied":
      return t(locale, "runNotStarted.prod");
    case "empty-scope":
      return t(locale, "runNotStarted.emptyScope");
    case "unresolved-target":
      return t(locale, "runNotStarted.unresolved");
    case "outputs-missing":
      return t(locale, "runNotStarted.outputsMissing");
  }
}

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
