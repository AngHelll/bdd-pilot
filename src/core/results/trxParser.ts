import { XMLParser } from "fast-xml-parser";

export type TestOutcome = "passed" | "failed" | "skipped" | "unknown";

export interface TestResult {
  testName: string;
  outcome: TestOutcome;
  durationMs?: number;
  errorMessage?: string;
  executionId?: string;
  testId?: string;
}

export interface TrxCounters {
  total: number;
  executed?: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TrxSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  counters?: TrxCounters;
}

interface TrxUnitTestResultNode {
  "@_testName"?: string;
  "@_outcome"?: string;
  "@_duration"?: string;
  "@_executionId"?: string;
  "@_testId"?: string;
  Output?: { ErrorInfo?: { Message?: string | number } };
}

interface TrxCountersNode {
  "@_total"?: string | number;
  "@_executed"?: string | number;
  "@_passed"?: string | number;
  "@_failed"?: string | number;
  "@_notExecuted"?: string | number;
  "@_skipped"?: string | number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "UnitTestResult",
});

/**
 * Parses the content of a Visual Studio TRX file into a flat list of results.
 * Resilient to single vs. multiple <UnitTestResult> nodes and missing fields.
 * When ResultSummary.Counters exists, run totals use those counters (B1.4),
 * except skipped is raised to the UnitTestResult count when the summary omits skips.
 */
export function parseTrx(xml: string): TrxSummary {
  const doc = parser.parse(xml) as { TestRun?: { Results?: { UnitTestResult?: TrxUnitTestResultNode[] }; ResultSummary?: { Counters?: TrxCountersNode } } };
  const run = doc?.TestRun;
  const resultsNode = run?.Results;
  const rawResults = resultsNode?.UnitTestResult ?? [];

  const results: TestResult[] = (Array.isArray(rawResults) ? rawResults : [rawResults])
    .filter((r): r is TrxUnitTestResultNode => Boolean(r && r["@_testName"] !== undefined))
    .map((r) => toTestResult(r));

  const counters = parseCounters(run?.ResultSummary?.Counters);
  const totals = reconcileTrxTotals(counters, results);

  const summary: TrxSummary = {
    total: totals.total,
    passed: totals.passed,
    failed: totals.failed,
    skipped: totals.skipped,
    results,
  };
  if (counters) {
    summary.counters = counters;
  }
  return summary;
}

/**
 * Prefer ResultSummary counters for passed/failed; raise skipped to the row
 * count when the summary under-reports NotExecuted/Skipped/Inconclusive.
 */
export function reconcileTrxTotals(
  counters: Pick<TrxCounters, "passed" | "failed" | "skipped" | "total"> | undefined,
  results: readonly TestResult[],
): { passed: number; failed: number; skipped: number; total: number } {
  const rowSkipped = results.filter((row) => row.outcome === "skipped").length;
  if (!counters) {
    return {
      passed: results.filter((row) => row.outcome === "passed").length,
      failed: results.filter((row) => row.outcome === "failed").length,
      skipped: rowSkipped,
      total: results.length,
    };
  }
  const skipped = counters.skipped >= rowSkipped ? counters.skipped : rowSkipped;
  const passed = counters.passed;
  const failed = counters.failed;
  const honestSum = passed + failed + skipped;
  const total = counters.total >= honestSum ? counters.total : honestSum;
  return { passed, failed, skipped, total };
}

function parseCounters(raw: TrxCountersNode | undefined): TrxCounters | undefined {
  if (!raw) {
    return undefined;
  }
  const total = parseAttrInt(raw["@_total"]);
  const passed = parseAttrInt(raw["@_passed"]);
  const failed = parseAttrInt(raw["@_failed"]);
  if (total === undefined && passed === undefined && failed === undefined) {
    return undefined;
  }
  const skipped =
    parseAttrInt(raw["@_notExecuted"]) ?? parseAttrInt(raw["@_skipped"]) ?? 0;
  return {
    total: total ?? (passed ?? 0) + (failed ?? 0) + skipped,
    executed: parseAttrInt(raw["@_executed"]),
    passed: passed ?? 0,
    failed: failed ?? 0,
    skipped,
  };
}

function parseAttrInt(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

function optionalAttr(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toTestResult(r: TrxUnitTestResultNode): TestResult {
  const result: TestResult = {
    testName: String(r["@_testName"]),
    outcome: normalizeOutcome(r["@_outcome"]),
    durationMs: parseDuration(r["@_duration"]),
    errorMessage: extractError(r),
  };
  const executionId = optionalAttr(r["@_executionId"]);
  const testId = optionalAttr(r["@_testId"]);
  if (executionId) {
    result.executionId = executionId;
  }
  if (testId) {
    result.testId = testId;
  }
  return result;
}

function normalizeOutcome(outcome: unknown): TestOutcome {
  switch (String(outcome).toLowerCase()) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "notexecuted":
    case "skipped":
    case "inconclusive":
      return "skipped";
    default:
      return "unknown";
  }
}

function parseDuration(duration: unknown): number | undefined {
  if (typeof duration !== "string") {
    return undefined;
  }
  // Format: HH:MM:SS.fffffff
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(duration);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function extractError(r: TrxUnitTestResultNode): string | undefined {
  const message = r?.Output?.ErrorInfo?.Message;
  return message !== undefined ? String(message) : undefined;
}

/** @deprecated Import from scenarioMatch.ts — kept for existing imports. */
export { matchesScenario } from "./scenarioMatch";
