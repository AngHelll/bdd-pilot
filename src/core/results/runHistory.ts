import { TestOutcome } from "./trxParser";

export interface ScenarioRunRecord {
  featurePath: string;
  scenarioLine: number;
  scenarioName: string;
  outcome: TestOutcome;
  durationMs?: number;
  errorMessage?: string;
}

export type RunHistoryStatus = "completed" | "canceled";

export interface RunHistoryEntry {
  id: string;
  timestamp: number;
  stage: string;
  mode: string;
  /** Human-readable run scope (e.g. all tests, @smoke). Omitted on legacy entries. */
  scopeLabel?: string;
  filter?: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  durationMs?: number;
  scenarios: ScenarioRunRecord[];
  /** Omitted on legacy entries — treated as completed. */
  status?: RunHistoryStatus;
}

export function scenarioHistoryKey(featurePath: string, scenarioLine: number, scenarioName: string): string {
  return `${featurePath}::${scenarioLine}::${scenarioName}`;
}

/** Keeps the most recent `max` entries. */
export function trimHistory(entries: RunHistoryEntry[], max: number): RunHistoryEntry[] {
  if (entries.length <= max) {
    return entries;
  }
  return entries.slice(entries.length - max);
}

/**
 * Flaky rate for a scenario: fraction of recent runs that failed (0–1).
 * Requires at least two runs touching the scenario.
 */
export function flakyRate(history: RunHistoryEntry[], key: string, window = 10): number {
  const recent = history.slice(-window);
  let runs = 0;
  let failures = 0;
  for (const entry of recent) {
    const rec = entry.scenarios.find(
      (s) => scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName) === key,
    );
    if (rec) {
      runs++;
      if (rec.outcome === "failed") {
        failures++;
      }
    }
  }
  if (runs < 2) {
    return 0;
  }
  return failures / runs;
}

/** Average duration for a scenario across recent runs (ms). */
export function averageDuration(history: RunHistoryEntry[], key: string, window = 10): number | undefined {
  const recent = history.slice(-window);
  const durations: number[] = [];
  for (const entry of recent) {
    const rec = entry.scenarios.find(
      (s) => scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName) === key,
    );
    if (rec?.durationMs !== undefined) {
      durations.push(rec.durationMs);
    }
  }
  if (durations.length === 0) {
    return undefined;
  }
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}
