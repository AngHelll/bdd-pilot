import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describe, it } from "node:test";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";
import {
  classifiedCounts,
  classifiedTotal,
  classifyFailedTests,
  classifyFromLog,
} from "../core/diagnostics/classifyFailedTests";
import { failureBreakdown } from "../core/diagnostics/failureBreakdown";
import { parseTrx } from "../core/results/trxParser";

const FIXTURE = path.join(__dirname, "../..", "src/test/fixtures/trx/classified-failures.trx");

describe("classifyFailedTests TRX fixture", () => {
  const summary = parseTrx(fs.readFileSync(FIXTURE, "utf8"));
  const classified = classifyFailedTests(summary.results);
  const counts = classifiedCounts(classified);

  it("parses ResultSummary counters matching the mix", () => {
    assert.strictEqual(summary.failed, 30);
    assert.strictEqual(summary.passed, 3);
    assert.strictEqual(summary.skipped, 1);
    assert.ok(summary.counters);
  });

  it("assigns exclusive buckets (13 pending, 2 testData, no double count)", () => {
    assert.strictEqual(counts.pending, 13);
    assert.strictEqual(counts.http, 5);
    assert.strictEqual(counts.aws, 4);
    assert.strictEqual(counts.code, 3);
    assert.strictEqual(counts.assert, 2);
    assert.strictEqual(counts.testData, 2);
    assert.strictEqual(counts.other, 1);
    assert.strictEqual(classifiedTotal(classified), summary.failed);
  });

  it("does not treat fixture in a NullReference stack as TEST_DATA_SETUP", () => {
    const nullRef = summary.results.find((row) => row.testName === "CodeFeature.NullRef");
    assert.ok(nullRef?.errorMessage?.includes("fixture"));
    assert.ok(classified.code.some((row) => row.testName === "CodeFeature.NullRef"));
    assert.ok(!classified.testData.some((row) => row.testName === "CodeFeature.NullRef"));
  });

  it("counts a pending test once even if the message repeats the pattern", () => {
    const first = classified.pending.find((row) => row.testName === "PendingFeature.Case01");
    assert.ok(first);
    const pendingDiag = analyzeDotnetOutput("Test run for App.dll\nFailed!  - Failed:   30, Passed:     3, Skipped:     1, Total:     34", {
      trxSummary: summary,
    }).find((d) => d.code === "PENDING_STEPS");
    assert.ok(pendingDiag?.title.includes("13"));
    const dataDiag = analyzeDotnetOutput("Test run for App.dll\nFailed!  - Failed:   30, Passed:     3, Skipped:     1, Total:     34", {
      trxSummary: summary,
    }).find((d) => d.code === "TEST_DATA_SETUP");
    assert.ok(dataDiag?.title.includes("2"));
  });

  it("breakdown sum does not exceed failed", () => {
    const detail = failureBreakdown("", "en", false, summary);
    assert.ok(detail);
    const nums = [...detail.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
    const sum = nums.reduce((a, b) => a + b, 0);
    assert.ok(sum <= summary.failed, `sum ${sum} > failed ${summary.failed}: ${detail}`);
  });
});

describe("classifyFailedTests dedup", () => {
  it("dedupes the same executionId", () => {
    const classified = classifyFailedTests([
      {
        testName: "A.One",
        outcome: "failed",
        executionId: "same",
        errorMessage: "XUnitPendingStepException : No matching step definition",
      },
      {
        testName: "A.One",
        outcome: "failed",
        executionId: "same",
        errorMessage: "XUnitPendingStepException : No matching step definition",
      },
    ]);
    assert.strictEqual(classified.pending.length, 1);
  });
});

describe("classifyFromLog fallback", () => {
  it("counts at most one pending even if the pattern repeats", () => {
    const classified = classifyFromLog(
      [
        "XUnitPendingStepException : No matching step definition",
        "XUnitPendingStepException : No matching step definition",
        "XUnitPendingStepException : No matching step definition",
      ].join("\n"),
    );
    assert.strictEqual(classified.pending.length, 1);
  });

  it("allows code and testData to coexist on a mixed log blob", () => {
    const classified = classifyFromLog(
      [
        "System.NullReferenceException : Object reference not set",
        "No available users found in pool",
      ].join("\n"),
    );
    assert.strictEqual(classified.code.length, 1);
    assert.strictEqual(classified.testData.length, 1);
  });
});
