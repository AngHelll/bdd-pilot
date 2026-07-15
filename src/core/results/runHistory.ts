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

/** Session kind — independent of xUnit parallelism `mode`. */
export type RunKind = "run" | "debug" | "profile";

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
  /**
   * How the session was launched. Omitted on legacy entries — treated as `"run"`.
   * Distinct from `mode` (xUnit parallelism: debug/parallel/ci).
   */
  runKind?: RunKind;
  /** Absolute path to TRX when generated. */
  trxPath?: string;
}

/** Legacy entries without `runKind` behave as a normal run. */
export function effectiveRunKind(entry: Pick<RunHistoryEntry, "runKind">): RunKind {
  return entry.runKind ?? "run";
}

/**
 * Resolves session kind from launch signals.
 * `debug` wins; `profile` only when explicitly requested (never inferred from rawFilter).
 */
export function resolveRunKind(input: { debug?: boolean; runKind?: RunKind }): RunKind {
  if (input.debug) {
    return "debug";
  }
  if (input.runKind === "profile") {
    return "profile";
  }
  if (input.runKind === "debug") {
    return "debug";
  }
  return "run";
}

/** Non-run kinds shown as dashboard badges; normal runs stay quiet. */
export function runKindBadgeKind(entry: Pick<RunHistoryEntry, "runKind">): "debug" | "profile" | undefined {
  const kind = effectiveRunKind(entry);
  return kind === "run" ? undefined : kind;
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
