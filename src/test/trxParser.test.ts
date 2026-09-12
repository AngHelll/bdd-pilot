import * as assert from "assert";
import { describe, it } from "node:test";
import { parseTrx, matchesScenario, reconcileTrxTotals } from "../core/results/trxParser";

const TRX = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="LoginFeature.SuccessfullyAuthenticateAndReceiveValidToken" outcome="Passed" duration="00:00:01.2500000" />
    <UnitTestResult testName="LoginFeature.RejectInvalidCredentials" outcome="Failed" duration="00:00:00.5000000">
      <Output><ErrorInfo><Message>Expected 401 but got 200</Message></ErrorInfo></Output>
    </UnitTestResult>
    <UnitTestResult testName="LoginFeature.SkippedOne" outcome="NotExecuted" />
  </Results>
</TestRun>`;

describe("trxParser", () => {
  it("parses counts and outcomes", () => {
    const summary = parseTrx(TRX);
    assert.strictEqual(summary.total, 3);
    assert.strictEqual(summary.passed, 1);
    assert.strictEqual(summary.failed, 1);
    assert.strictEqual(summary.skipped, 1);
  });

  it("parses duration to ms and error message", () => {
    const summary = parseTrx(TRX);
    const passed = summary.results.find((r) => r.outcome === "passed")!;
    assert.strictEqual(passed.durationMs, 1250);
    const failed = summary.results.find((r) => r.outcome === "failed")!;
    assert.strictEqual(failed.errorMessage, "Expected 401 but got 200");
  });

  it("handles a single result node", () => {
    const single = `<TestRun><Results><UnitTestResult testName="A.B" outcome="Passed" /></Results></TestRun>`;
    const summary = parseTrx(single);
    assert.strictEqual(summary.total, 1);
    assert.strictEqual(summary.passed, 1);
  });

  it("matchesScenario ignores casing and punctuation", () => {
    assert.ok(
      matchesScenario(
        "LoginFeature.SuccessfullyAuthenticateAndReceiveValidToken",
        "Successfully authenticate and receive valid token",
      ),
    );
    assert.ok(!matchesScenario("LoginFeature.Other", "Completely different name"));
  });

  it("reads executionId, testId, and ResultSummary counters over results.length", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Failed">
    <Counters total="10" executed="9" passed="7" failed="2" notExecuted="1" />
  </ResultSummary>
  <Results>
    <UnitTestResult executionId="e1" testId="t1" testName="A.One" outcome="Failed">
      <Output><ErrorInfo><Message>boom</Message></ErrorInfo></Output>
    </UnitTestResult>
    <UnitTestResult executionId="e2" testId="t2" testName="A.Two" outcome="Passed" />
  </Results>
</TestRun>`;
    const summary = parseTrx(xml);
    assert.strictEqual(summary.total, 10);
    assert.strictEqual(summary.passed, 7);
    assert.strictEqual(summary.failed, 2);
    assert.strictEqual(summary.skipped, 1);
    assert.strictEqual(summary.results.length, 2);
    assert.strictEqual(summary.results[0].executionId, "e1");
    assert.strictEqual(summary.results[0].testId, "t1");
  });

  it("raises skipped when ResultSummary is 0 but rows are NotExecuted", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary outcome="Completed">
    <Counters total="4" executed="2" passed="1" failed="1" notExecuted="0" skipped="0" />
  </ResultSummary>
  <Results>
    <UnitTestResult testName="AlphaFeature.RowOne" outcome="Passed" />
    <UnitTestResult testName="AlphaFeature.RowTwo" outcome="Failed" />
    <UnitTestResult testName="AlphaFeature.RowThree" outcome="NotExecuted" />
    <UnitTestResult testName="AlphaFeature.RowFour" outcome="Skipped" />
  </Results>
</TestRun>`;
    const summary = parseTrx(xml);
    assert.strictEqual(summary.skipped, 2);
    assert.strictEqual(summary.passed, 1);
    assert.strictEqual(summary.failed, 1);
    assert.strictEqual(summary.total, 4);
  });

  it("does not lower skipped when ResultSummary already reports the rows", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun>
  <ResultSummary>
    <Counters total="3" passed="0" failed="0" notExecuted="3" />
  </ResultSummary>
  <Results>
    <UnitTestResult testName="AlphaFeature.RowOne" outcome="NotExecuted" />
    <UnitTestResult testName="AlphaFeature.RowTwo" outcome="NotExecuted" />
    <UnitTestResult testName="AlphaFeature.RowThree" outcome="NotExecuted" />
  </Results>
</TestRun>`;
    const summary = parseTrx(xml);
    assert.strictEqual(summary.skipped, 3);
    assert.strictEqual(summary.total, 3);
  });

  it("keeps skipped at 0 when neither counters nor rows report skips", () => {
    const totals = reconcileTrxTotals(
      { total: 2, passed: 1, failed: 1, skipped: 0 },
      [
        { testName: "AlphaFeature.RowOne", outcome: "passed" },
        { testName: "AlphaFeature.RowTwo", outcome: "failed" },
      ],
    );
    assert.strictEqual(totals.skipped, 0);
    assert.strictEqual(totals.passed, 1);
    assert.strictEqual(totals.failed, 1);
    assert.strictEqual(totals.total, 2);
  });
});
