import { effectiveRunKind, RunHistoryEntry, RunKind } from "./runHistory";
import { isCanceledRun, runHistoryStatus } from "./dashboardLastKnown";

export type DashboardOutcomeFilter = "all" | "any_failure" | "all_passed" | "canceled";

export interface DashboardHistoryFilter {
  stage?: string; // undefined / "" / "all" = no filter
  outcome: DashboardOutcomeFilter;
  runKind?: RunKind | "all";
}

export const DEFAULT_DASHBOARD_HISTORY_FILTER: DashboardHistoryFilter = {
  outcome: "all",
  runKind: "all",
};

function stageMatches(entry: RunHistoryEntry, stage: string | undefined): boolean {
  if (!stage || stage === "all") {
    return true;
  }
  return entry.stage === stage;
}

function runKindMatches(entry: RunHistoryEntry, runKind: RunKind | "all" | undefined): boolean {
  if (!runKind || runKind === "all") {
    return true;
  }
  return effectiveRunKind(entry) === runKind;
}

function outcomeMatches(entry: RunHistoryEntry, outcome: DashboardOutcomeFilter): boolean {
  switch (outcome) {
    case "all":
      return true;
    case "canceled":
      return isCanceledRun(entry) || runHistoryStatus(entry) === "canceled";
    case "any_failure":
      return !isCanceledRun(entry) && entry.failed > 0;
    case "all_passed":
      return !isCanceledRun(entry) && entry.failed === 0 && entry.total > 0 && entry.passed === entry.total;
    default:
      return true;
  }
}

export function filterRunHistory(
  entries: RunHistoryEntry[],
  filter: DashboardHistoryFilter,
): RunHistoryEntry[] {
  return entries.filter(
    (entry) =>
      stageMatches(entry, filter.stage) &&
      runKindMatches(entry, filter.runKind) &&
      outcomeMatches(entry, filter.outcome),
  );
}

/** Distinct stages in history (stable insertion order, newest-first preferred). */
export function listHistoryStages(entries: RunHistoryEntry[]): string[] {
  const seen = new Set<string>();
  const stages: string[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const stage = entries[i]!.stage;
    if (!seen.has(stage)) {
      seen.add(stage);
      stages.push(stage);
    }
  }
  return stages;
}

export function parseDashboardHistoryFilterMessage(
  message: unknown,
): DashboardHistoryFilter | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const msg = message as Record<string, unknown>;
  if (msg.type !== "filterHistory") {
    return undefined;
  }
  const outcomeRaw = msg.outcome;
  const outcome: DashboardOutcomeFilter =
    outcomeRaw === "any_failure" ||
    outcomeRaw === "all_passed" ||
    outcomeRaw === "canceled" ||
    outcomeRaw === "all"
      ? outcomeRaw
      : "all";
  const stage = typeof msg.stage === "string" ? msg.stage : "all";
  const runKindRaw = msg.runKind;
  const runKind: RunKind | "all" =
    runKindRaw === "run" || runKindRaw === "debug" || runKindRaw === "profile" || runKindRaw === "all"
      ? runKindRaw
      : "all";
  return { stage, outcome, runKind };
}
