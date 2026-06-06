import { OutcomeRollup } from "../gherkin/outcomeRollup";
import { RehydrateNotice } from "./rehydrateNotice";
import { RunHistoryEntry, RunHistoryStatus } from "./runHistory";

export type LastKnownProvenance = "fromLiveSession" | "fromHistory" | "fromRehydrate";

export interface LastKnownSnapshot {
  passed: number;
  failed: number;
  skipped: number;
  provenance: LastKnownProvenance;
  durationMs?: number;
  historyTimestamp?: number;
}

export function resolveLastKnownSnapshot(
  storeRollup: OutcomeRollup | undefined,
  storeNonEmpty: boolean,
  lastHistory: RunHistoryEntry | undefined,
  rehydrateNotice: RehydrateNotice | undefined,
): LastKnownSnapshot | undefined {
  if (storeNonEmpty && storeRollup) {
    return {
      passed: storeRollup.passed,
      failed: storeRollup.failed,
      skipped: storeRollup.skipped,
      provenance: rehydrateNotice ? "fromRehydrate" : "fromLiveSession",
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

export function isCanceledRun(entry: RunHistoryEntry): boolean {
  return entry.status === "canceled";
}

export function runHistoryStatus(entry: RunHistoryEntry): RunHistoryStatus {
  return entry.status ?? "completed";
}
