import { TestResult } from "../results/trxParser";

export type FailureBucket = "pending" | "aws" | "http" | "assert" | "code" | "testData" | "other";

export interface ClassifiedFailures {
  pending: TestResult[];
  aws: TestResult[];
  http: TestResult[];
  assert: TestResult[];
  code: TestResult[];
  testData: TestResult[];
  other: TestResult[];
}

const PENDING_RE = /XUnitPendingStepException|No matching step definition/i;
const AWS_RE = /The security token included in the request is invalid/i;
const HTTP_REFIT_RE = /Refit\.ApiException/i;
const HTTP_STATUS_RE = /Response status code does not indicate success:\s*(\d+)/i;
const ASSERT_RE = /Xunit\.Sdk\.|XunitException|Shouldly|Assert\./i;
const CODE_RE = /NullReferenceException|KeyNotFoundException|InvalidOperationException/i;
const TEST_DATA_RE =
  /No available users|No suitable user|No hay usuarios|The array cannot be null or empty/i;

export function emptyClassifiedFailures(): ClassifiedFailures {
  return {
    pending: [],
    aws: [],
    http: [],
    assert: [],
    code: [],
    testData: [],
    other: [],
  };
}

export function classifiedCounts(classified: ClassifiedFailures): Record<FailureBucket, number> {
  return {
    pending: classified.pending.length,
    aws: classified.aws.length,
    http: classified.http.length,
    assert: classified.assert.length,
    code: classified.code.length,
    testData: classified.testData.length,
    other: classified.other.length,
  };
}

export function classifiedTotal(classified: ClassifiedFailures): number {
  const counts = classifiedCounts(classified);
  return (
    counts.pending +
    counts.aws +
    counts.http +
    counts.assert +
    counts.code +
    counts.testData +
    counts.other
  );
}

function uniqueFailed(results: TestResult[]): TestResult[] {
  const failed = results.filter((row) => row.outcome === "failed");
  const seen = new Set<string>();
  const unique: TestResult[] = [];
  for (const row of failed) {
    const id = row.executionId?.trim() || `${row.testId ?? ""}|${row.testName}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

export function classifyOneMessage(message: string): FailureBucket {
  if (PENDING_RE.test(message)) {
    return "pending";
  }
  if (AWS_RE.test(message)) {
    return "aws";
  }
  if (isHttpFailure(message)) {
    return "http";
  }
  if (ASSERT_RE.test(message)) {
    return "assert";
  }
  const isData = TEST_DATA_RE.test(message);
  if (CODE_RE.test(message) && !isData) {
    return "code";
  }
  if (isData) {
    return "testData";
  }
  return "other";
}

function isHttpFailure(message: string): boolean {
  if (HTTP_REFIT_RE.test(message)) {
    return true;
  }
  const status = HTTP_STATUS_RE.exec(message);
  if (status) {
    return true;
  }
  return /\bHTTP\s*(400|401|403|404|422|5\d{2})\b/i.test(message);
}

/** One failed UnitTestResult → one bucket. Deduped by executionId, else testId+testName. */
export function classifyFailedTests(results: TestResult[]): ClassifiedFailures {
  const classified = emptyClassifiedFailures();
  for (const row of uniqueFailed(results)) {
    classified[classifyOneMessage(row.errorMessage ?? "")].push(row);
  }
  return classified;
}

/**
 * Log fallback when no TRX: at most one hit per category (no substring inflation).
 * Categories may coexist on a mixed blob; exclusive assignment is TRX-per-test only.
 */
export function classifyFromLog(output: string): ClassifiedFailures {
  const classified = emptyClassifiedFailures();
  const add = (bucket: FailureBucket, hit: boolean): void => {
    if (hit) {
      classified[bucket].push({ testName: bucket, outcome: "failed" });
    }
  };
  add("pending", PENDING_RE.test(output));
  add("aws", AWS_RE.test(output));
  add("http", isHttpFailure(output));
  add("assert", ASSERT_RE.test(output));
  add("code", CODE_RE.test(output));
  add("testData", TEST_DATA_RE.test(output));
  return classified;
}
