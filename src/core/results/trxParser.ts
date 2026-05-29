import { XMLParser } from "fast-xml-parser";

export type TestOutcome = "passed" | "failed" | "skipped" | "unknown";

export interface TestResult {
  testName: string;
  outcome: TestOutcome;
  durationMs?: number;
  errorMessage?: string;
}

export interface TrxSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "UnitTestResult",
});

/**
 * Parses the content of a Visual Studio TRX file into a flat list of results.
 * Resilient to single vs. multiple <UnitTestResult> nodes and missing fields.
 */
export function parseTrx(xml: string): TrxSummary {
  const doc = parser.parse(xml);
  const run = doc?.TestRun;
  const resultsNode = run?.Results;
  const rawResults = resultsNode?.UnitTestResult ?? [];

  const results: TestResult[] = (Array.isArray(rawResults) ? rawResults : [rawResults])
    .filter((r: any) => r && r["@_testName"] !== undefined)
    .map((r: any) => toTestResult(r));

  const summary: TrxSummary = {
    total: results.length,
    passed: results.filter((r) => r.outcome === "passed").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    skipped: results.filter((r) => r.outcome === "skipped").length,
    results,
  };
  return summary;
}

function toTestResult(r: any): TestResult {
  return {
    testName: String(r["@_testName"]),
    outcome: normalizeOutcome(r["@_outcome"]),
    durationMs: parseDuration(r["@_duration"]),
    errorMessage: extractError(r),
  };
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

function extractError(r: any): string | undefined {
  const message = r?.Output?.ErrorInfo?.Message;
  return message !== undefined ? String(message) : undefined;
}

/** @deprecated Import from scenarioMatch.ts — kept for existing imports. */
export { matchesScenario } from "./scenarioMatch";
