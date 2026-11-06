import { formatRollupDescriptionLocalized, OutcomeRollup } from "../gherkin/outcomeRollup";
import { PilotLocale, t } from "../i18n";
import { reliableRunDurationMs } from "./dashboardLatestRun";
import { RehydrateNotice } from "./rehydrateNotice";
import { RunHistoryEntry, RunHistoryStatus } from "./runHistory";

export type LastKnownProvenance = "fromLiveSession" | "fromHistory" | "fromRehydrate";

export interface TrxCountTriple {
  passed: number;
  failed: number;
  skipped: number;
}

export interface LastKnownSnapshot {
  passed: number;
  failed: number;
  skipped: number;
  provenance: LastKnownProvenance;
  durationMs?: number;
  historyTimestamp?: number;
  /** Present when mapped (store) counts diverge from TRX/history counters. */
  trx?: TrxCountTriple;
}

export function trxCountsDiverge(mapped: TrxCountTriple, trx: TrxCountTriple): boolean {
  return mapped.passed !== trx.passed || mapped.failed !== trx.failed || mapped.skipped !== trx.skipped;
}

/** Wall clock of the same history entry. A restore does not use this. */
function liveSessionClock(
  entry: RunHistoryEntry,
): Pick<LastKnownSnapshot, "durationMs" | "historyTimestamp"> {
  const durationMs = reliableRunDurationMs(entry.durationMs);
  return {
    historyTimestamp: entry.timestamp,
    ...(durationMs === undefined ? {} : { durationMs }),
  };
}

function countsFromHistory(lastHistory: RunHistoryEntry): TrxCountTriple {
  return {
    passed: lastHistory.passed,
    failed: lastHistory.failed,
    skipped: lastHistory.skipped,
  };
}

export function resolveLastKnownSnapshot(
  storeRollup: OutcomeRollup | undefined,
  storeNonEmpty: boolean,
  lastHistory: RunHistoryEntry | undefined,
  rehydrateNotice: RehydrateNotice | undefined,
): LastKnownSnapshot | undefined {
  if (storeNonEmpty && storeRollup) {
    const mapped: TrxCountTriple = {
      passed: storeRollup.passed,
      failed: storeRollup.failed,
      skipped: storeRollup.skipped,
    };
    const trx = lastHistory ? countsFromHistory(lastHistory) : undefined;
    const provenance = rehydrateNotice ? "fromRehydrate" : "fromLiveSession";
    return {
      ...mapped,
      provenance,
      trx: trx && trxCountsDiverge(mapped, trx) ? trx : undefined,
      ...(provenance === "fromLiveSession" && lastHistory ? liveSessionClock(lastHistory) : {}),
    };
  }

  if (lastHistory) {
    return {
      passed: lastHistory.passed,
      failed: lastHistory.failed,
      skipped: lastHistory.skipped,
      provenance: "fromHistory",
      durationMs: lastHistory.durationMs,
      historyTimestamp: lastHistory.timestamp,
    };
  }

  return undefined;
}

export function formatTrxCountSuffix(trx: TrxCountTriple, locale: PilotLocale): string {
  return t(locale, "tree.summaryTrxCounts", {
    passed: trx.passed,
    failed: trx.failed,
    skipped: trx.skipped,
  });
}

export function formatTrxDivergenceTooltip(locale: PilotLocale): string {
  return t(locale, "tree.summaryTrxTooltip");
}

/** Mapped roll-up, plus a TRX suffix when counts diverge. Truncates the suffix to fit maxLen. */
export function formatMappedWithTrxSuffix(
  mappedPart: string,
  trx: TrxCountTriple | undefined,
  locale: PilotLocale,
  maxLen?: number,
): string {
  if (!trx || !mappedPart) {
    return mappedPart;
  }
  const suffix = ` · ${formatTrxCountSuffix(trx, locale)}`;
  if (maxLen === undefined) {
    return `${mappedPart}${suffix}`;
  }
  const room = maxLen - mappedPart.length;
  if (room < 2) {
    return mappedPart;
  }
  if (suffix.length <= room) {
    return `${mappedPart}${suffix}`;
  }
  return `${mappedPart}${suffix.slice(0, room - 1)}…`;
}

export function formatLastKnownCounts(
  snapshot: LastKnownSnapshot,
  locale: PilotLocale,
  maxLen?: number,
): string | undefined {
  const rollup = {
    passed: snapshot.passed,
    failed: snapshot.failed,
    skipped: snapshot.skipped,
    withResults: snapshot.passed + snapshot.failed + snapshot.skipped,
  };
  const mappedPart = formatRollupDescriptionLocalized(rollup, locale);
  if (!mappedPart) {
    return undefined;
  }
  return formatMappedWithTrxSuffix(mappedPart, snapshot.trx, locale, maxLen);
}

export function isCanceledRun(entry: RunHistoryEntry): boolean {
  return entry.status === "canceled";
}

export function runHistoryStatus(entry: RunHistoryEntry): RunHistoryStatus {
  return entry.status ?? "completed";
}
