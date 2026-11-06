import { PilotLocale, t } from "../i18n";
import { formatDashboardScenarioLabel } from "./dashboardExampleLabel";
import { DashboardTotals } from "./dashboardFormat";
import type { LastKnownSnapshot } from "./dashboardLastKnown";
import { formatDuration } from "./durationFormat";
import { sanitizeErrorForStore, truncateErrorSnippet } from "./outcomeFeedback";
import { RunHistoryEntry } from "./runHistory";

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

export interface FirstStoredFailure {
  heading: string;
  label: string;
  title: string;
  featureBasename?: string;
  /** Full path for the title attribute and the open button. */
  featurePath?: string;
  scenarioLine: number;
  canOpen: boolean;
  durationLabel?: string;
  /** One-line visible message. */
  errorSnippet?: string;
  /** Sanitized message for the title attribute. */
  errorFull?: string;
}

/**
 * First failed record on the same history entry as the header clock.
 * Stored order. Hidden when the visible counts have no failure, the entry has
 * no failed record, or the snapshot was restored from TestResults.
 */
export function presentFirstStoredFailure(
  snapshot: LastKnownSnapshot | undefined,
  entry: RunHistoryEntry | undefined,
  locale: PilotLocale,
): FirstStoredFailure | undefined {
  if (!snapshot || snapshot.failed <= 0 || !entry) {
    return undefined;
  }
  if (snapshot.provenance !== "fromLiveSession" && snapshot.provenance !== "fromHistory") {
    return undefined;
  }
  const failed = entry.scenarios.filter((scenario) => scenario.outcome === "failed");
  const first = failed[0];
  if (!first) {
    return undefined;
  }
  const visible = formatDashboardScenarioLabel(first.scenarioName);
  const featurePath = first.featurePath.trim();
  const durationMs = reliableRunDurationMs(first.durationMs);
  const errorFull = sanitizeErrorForStore(first.errorMessage);
  return {
    heading:
      failed.length > 1
        ? t(locale, "dashboard.firstFailureTitleOf", { count: failed.length })
        : t(locale, "dashboard.firstFailureTitle"),
    label: visible.label,
    title: visible.title,
    featureBasename: featurePath ? featureBasename(featurePath) : undefined,
    featurePath: featurePath || undefined,
    scenarioLine: first.scenarioLine,
    canOpen: featurePath.length > 0 && first.scenarioLine > 0,
    durationLabel: durationMs === undefined ? undefined : formatDuration(durationMs, "auto"),
    errorSnippet: errorFull ? truncateErrorSnippet(errorFull) : undefined,
    errorFull,
  };
}

function featureBasename(featurePath: string): string {
  const normalized = featurePath.replace(/\\/g, "/");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** A stored duration is reliable at zero. Missing, NaN, and negative values are not. */
export function reliableRunDurationMs(ms: number | undefined): number | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
    return undefined;
  }
  return ms;
}
