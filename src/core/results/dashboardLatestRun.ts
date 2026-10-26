import { PilotLocale, t } from "../i18n";
import { DashboardTotals } from "./dashboardFormat";
import { formatDuration } from "./durationFormat";
import { LastKnownSnapshot } from "./dashboardLastKnown";

export interface LatestRunPresentation {
  passed: number;
  failed: number;
  skipped: number;
  provenance: LastKnownSnapshot["provenance"];
  /** Set only when the snapshot recorded a finite, non-negative duration. */
  durationLabel?: string;
  historyTimestamp?: number;
  trxDiverges: boolean;
}

/**
 * Hero counts for the dashboard. Returns undefined when no snapshot was resolved,
 * so the view does not pick a run out of history on its own.
 */
export function presentLatestRun(
  snapshot: LastKnownSnapshot | undefined,
): LatestRunPresentation | undefined {
  if (!snapshot) {
    return undefined;
  }
  const durationMs = reliableRunDurationMs(snapshot.durationMs);
  return {
    passed: snapshot.passed,
    failed: snapshot.failed,
    skipped: snapshot.skipped,
    provenance: snapshot.provenance,
    durationLabel: durationMs === undefined ? undefined : formatDuration(durationMs, "auto"),
    historyTimestamp: snapshot.historyTimestamp,
    trxDiverges: snapshot.trx !== undefined,
  };
}

/** Secondary historical line. Undefined when there are no recorded runs. */
export function presentHistoryTotalsLine(
  totals: DashboardTotals,
  locale: PilotLocale,
): string | undefined {
  if (totals.runs <= 0) {
    return undefined;
  }
  const runsText =
    totals.runs === 1
      ? t(locale, "dashboard.historyOneRun")
      : t(locale, "dashboard.historyManyRuns", { count: totals.runs });
  const base = t(locale, "dashboard.historyTotals", {
    runs: runsText,
    passed: totals.passed,
    failed: totals.failed,
  });
  if (totals.canceled <= 0) {
    return base;
  }
  return `${base}${t(locale, "rollup.separator")}${t(locale, "dashboard.historyCanceled", {
    count: totals.canceled,
  })}`;
}

/** A stored duration is reliable at zero. Missing, NaN, and negative values are not. */
export function reliableRunDurationMs(ms: number | undefined): number | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    return undefined;
  }
  return ms;
}
