import { runHistoryStatus } from "./dashboardLastKnown";
import { sanitizeErrorForStore, truncateErrorSnippet } from "./outcomeFeedback";
import {
  RunHistoryEntry,
  ScenarioRunRecord,
  averageDuration,
  flakyRate,
  scenarioHistoryKey,
} from "./runHistory";

export interface FlakyDashboardRow {
  key: string;
  scenarioName: string;
  featurePath: string;
  scenarioLine: number;
  failureRate: number;
  averageDurationMs?: number;
  lastErrorSnippet?: string;
  canOpen: boolean;
}

export interface BuildFlakyDashboardRowsOptions {
  window?: number;
  maxRows?: number;
}

export interface FlakyOpenTarget {
  featurePath: string;
  scenarioLine: number;
}

/**
 * Most recent failure message for a scenario within the window (sanitized + truncated for UI).
 */
export function lastScenarioFailureMessage(
  history: RunHistoryEntry[],
  key: string,
  window = 10,
): string | undefined {
  const recent = history.slice(-window);
  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i]!;
    if (runHistoryStatus(entry) === "canceled") {
      continue;
    }
    const rec = entry.scenarios.find(
      (s) => scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName) === key,
    );
    if (rec?.outcome === "failed" && rec.errorMessage?.trim()) {
      const sanitized = sanitizeErrorForStore(rec.errorMessage);
      if (sanitized) {
        return truncateErrorSnippet(sanitized);
      }
    }
  }
  return undefined;
}

function collectFlakyKeys(history: RunHistoryEntry[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of history) {
    if (runHistoryStatus(entry) === "canceled") {
      continue;
    }
    for (const s of entry.scenarios) {
      keys.add(scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName));
    }
  }
  return keys;
}

function findScenarioMetadata(
  history: RunHistoryEntry[],
  key: string,
): Pick<ScenarioRunRecord, "featurePath" | "scenarioLine" | "scenarioName"> | undefined {
  for (const entry of history) {
    for (const s of entry.scenarios) {
      if (scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName) === key) {
        return s;
      }
    }
  }
  return undefined;
}

export function buildFlakyDashboardRows(
  history: RunHistoryEntry[],
  options: BuildFlakyDashboardRowsOptions = {},
): FlakyDashboardRow[] {
  const window = options.window ?? 10;
  const maxRows = options.maxRows ?? 10;
  const keys = collectFlakyKeys(history);
  const out: FlakyDashboardRow[] = [];

  for (const key of keys) {
    const rate = flakyRate(history, key, window);
    if (rate <= 0) {
      continue;
    }

    const meta = findScenarioMetadata(history, key);
    const featurePath = meta?.featurePath ?? "";
    const scenarioLine = meta?.scenarioLine ?? 0;
    const scenarioName = meta?.scenarioName ?? key;

    out.push({
      key,
      scenarioName,
      featurePath,
      scenarioLine,
      failureRate: rate,
      averageDurationMs: averageDuration(history, key, window),
      lastErrorSnippet: lastScenarioFailureMessage(history, key, window),
      canOpen: featurePath.trim().length > 0 && scenarioLine > 0,
    });
  }

  return out.sort((a, b) => b.failureRate - a.failureRate).slice(0, maxRows);
}

export function parseFlakyOpenMessage(message: unknown): FlakyOpenTarget | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const command = (message as { command?: unknown }).command;
  if (command !== "openFlakyScenario") {
    return undefined;
  }
  const featurePath = (message as { featurePath?: unknown }).featurePath;
  const scenarioLine = (message as { scenarioLine?: unknown }).scenarioLine;
  if (typeof featurePath !== "string" || !featurePath.trim()) {
    return undefined;
  }
  if (typeof scenarioLine !== "number" || !Number.isInteger(scenarioLine) || scenarioLine < 1) {
    return undefined;
  }
  return { featurePath: featurePath.trim(), scenarioLine };
}
