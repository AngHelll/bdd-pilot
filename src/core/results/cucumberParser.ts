import { TestOutcome, TestResult } from "./trxParser";

export interface CucumberSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

interface CucumberElement {
  type?: string;
  name?: string;
  keyword?: string;
  line?: number;
  steps?: { result?: { status?: string; error_message?: string; duration?: number } }[];
}

interface CucumberFeature {
  name?: string;
  uri?: string;
  elements?: CucumberElement[];
}

/**
 * Parses Cucumber JSON report format (array of features). Duration in steps is
 * typically nanoseconds; we convert to ms when present.
 */
export function parseCucumberJson(json: string): CucumberSummary {
  const features = JSON.parse(json) as CucumberFeature[];
  const results: TestResult[] = [];

  for (const feature of features) {
    const featureName = feature.name ?? "Feature";
    for (const element of feature.elements ?? []) {
      if (element.type !== "scenario" && element.keyword !== "Scenario") {
        continue;
      }
      const scenarioName = element.name ?? "Scenario";
      const outcome = elementOutcome(element);
      const durationMs = elementDurationMs(element);
      const errorMessage = elementError(element);
      results.push({
        testName: `${featureName}.${scenarioName}`,
        outcome,
        durationMs,
        errorMessage,
      });
    }
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.outcome === "passed").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    skipped: results.filter((r) => r.outcome === "skipped").length,
    results,
  };
}

function elementOutcome(element: CucumberElement): TestOutcome {
  const steps = element.steps ?? [];
  if (steps.length === 0) {
    return "unknown";
  }
  if (steps.some((s) => s.result?.status === "failed")) {
    return "failed";
  }
  if (steps.every((s) => s.result?.status === "passed" || s.result?.status === "skipped")) {
    return steps.some((s) => s.result?.status === "passed") ? "passed" : "skipped";
  }
  return "unknown";
}

function elementDurationMs(element: CucumberElement): number | undefined {
  let totalNs = 0;
  for (const step of element.steps ?? []) {
    const d = step.result?.duration;
    if (typeof d === "number") {
      totalNs += d;
    }
  }
  return totalNs > 0 ? Math.round(totalNs / 1_000_000) : undefined;
}

function elementError(element: CucumberElement): string | undefined {
  for (const step of element.steps ?? []) {
    if (step.result?.error_message) {
      return String(step.result.error_message);
    }
  }
  return undefined;
}
