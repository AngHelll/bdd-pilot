import { sanitizeErrorForStore, truncateErrorSnippet } from "./outcomeFeedback";
import {
  effectiveRunKind,
  RunHistoryEntry,
  RunHistoryStatus,
  RunKind,
  scenarioHistoryKey,
  ScenarioRunRecord,
} from "./runHistory";
import { runHistoryStatus } from "./dashboardLastKnown";
import { TestOutcome } from "./trxParser";

export const SCENARIO_HISTORY_DEFAULT_WINDOW = 10;

export interface ScenarioHistoryRow {
  entryId: string;
  timestamp: number;
  stage: string;
  runKind: RunKind;
  outcome: TestOutcome;
  durationMs?: number;
  errorSnippet?: string;
  scopeLabel?: string;
  status: RunHistoryStatus;
}

export interface ScenarioHistoryView {
  key: string;
  scenarioName: string;
  featurePath: string;
  scenarioLine: number;
  /** True when the requested key had no rows but a parent-scenario key did. */
  usedParentFallback: boolean;
  rows: ScenarioHistoryRow[];
}

function findRecord(
  entry: RunHistoryEntry,
  key: string,
): ScenarioRunRecord | undefined {
  return entry.scenarios.find(
    (s) => scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName) === key,
  );
}

function parentScenarioKeyHint(
  history: RunHistoryEntry[],
  featurePath: string,
  scenarioName: string,
): string | undefined {
  for (const entry of history) {
    for (const s of entry.scenarios) {
      if (s.featurePath === featurePath && s.scenarioName === scenarioName) {
        return scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName);
      }
    }
  }
  return undefined;
}

function buildRowsForKey(
  history: RunHistoryEntry[],
  key: string,
  window: number,
): ScenarioHistoryRow[] {
  const recent = history.slice(-window);
  const rows: ScenarioHistoryRow[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i]!;
    const rec = findRecord(entry, key);
    if (!rec) {
      continue;
    }
    const snippet =
      rec.outcome === "failed" && rec.errorMessage?.trim()
        ? truncateErrorSnippet(sanitizeErrorForStore(rec.errorMessage) ?? "")
        : undefined;
    rows.push({
      entryId: entry.id,
      timestamp: entry.timestamp,
      stage: entry.stage,
      runKind: effectiveRunKind(entry),
      outcome: rec.outcome,
      durationMs: rec.durationMs,
      errorSnippet: snippet || undefined,
      scopeLabel: entry.scopeLabel,
      status: runHistoryStatus(entry),
    });
  }
  return rows;
}

function metadataFromHistory(
  history: RunHistoryEntry[],
  key: string,
): Pick<ScenarioRunRecord, "featurePath" | "scenarioLine" | "scenarioName"> | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const rec = findRecord(history[i]!, key);
    if (rec) {
      return rec;
    }
  }
  return undefined;
}

/**
 * History of one scenario across recent runs (newest first).
 * If `key` has no rows, tries parent by featurePath + scenarioName when provided.
 */
export function buildScenarioHistoryView(
  history: RunHistoryEntry[],
  key: string,
  options?: {
    window?: number;
    /** Used for outline-row fallback to parent scenario name. */
    featurePath?: string;
    scenarioName?: string;
  },
): ScenarioHistoryView {
  const window = options?.window ?? SCENARIO_HISTORY_DEFAULT_WINDOW;
  let usedKey = key;
  let usedParentFallback = false;
  let rows = buildRowsForKey(history, usedKey, window);

  if (
    rows.length === 0 &&
    options?.featurePath &&
    options?.scenarioName
  ) {
    const parentKey = parentScenarioKeyHint(history, options.featurePath, options.scenarioName);
    if (parentKey && parentKey !== key) {
      const parentRows = buildRowsForKey(history, parentKey, window);
      if (parentRows.length > 0) {
        usedKey = parentKey;
        rows = parentRows;
        usedParentFallback = true;
      }
    }
  }

  const meta = metadataFromHistory(history, usedKey);
  return {
    key: usedKey,
    scenarioName: meta?.scenarioName ?? options?.scenarioName ?? key,
    featurePath: meta?.featurePath ?? options?.featurePath ?? "",
    scenarioLine: meta?.scenarioLine ?? 0,
    usedParentFallback,
    rows,
  };
}

export function formatScenarioHistoryPickLabel(row: ScenarioHistoryRow): string {
  const when = new Date(row.timestamp).toISOString().replace("T", " ").slice(0, 16);
  const kind = row.runKind === "run" ? "" : ` · ${row.runKind}`;
  const status = row.status === "canceled" ? " · canceled" : "";
  return `${when} · ${row.stage}${kind} · ${row.outcome}${status}`;
}
