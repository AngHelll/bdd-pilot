import { TreeMappingReport } from "./trxTreeMapping";

/** In-memory last scoped mapping report for the session (not persisted). */
let lastReport: TreeMappingReport | undefined;

export function setLastMappingReport(report: TreeMappingReport | undefined): void {
  lastReport = report;
}

export function getLastMappingReport(): TreeMappingReport | undefined {
  return lastReport;
}

/** Clears session report (tests / run-all). */
export function clearLastMappingReport(): void {
  lastReport = undefined;
}
