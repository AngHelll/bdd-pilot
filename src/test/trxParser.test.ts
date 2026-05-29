import * as assert from "assert";
import { describe, it } from "node:test";
import { parseTrx, matchesScenario } from "../core/results/trxParser";

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
});
