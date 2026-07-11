import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import { buildAiFailureContext } from "../core/diagnostics/aiFailureContext";
import {
  buildFailureSnapshotFromArtifacts,
  hasFailureContext,
  NoFailureContextError,
} from "../core/diagnostics/failureSnapshotFromArtifacts";
import { parseTrx } from "../core/results/trxParser";

const repoRoot = path.resolve(__dirname, "..", "..");
const sampleDir = path.join(repoRoot, "samples", "minimal-bdd");

const FAILED_TRX = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="SmokeFeature.SystemIsReady" outcome="Failed" duration="00:00:00.5000000">
      <Output><ErrorInfo><Message>Expected true but was false</Message></ErrorInfo></Output>
    </UnitTestResult>
    <UnitTestResult testName="SmokeFeature.AddTwoNumbers" outcome="Passed" duration="00:00:01.0000000" />
  </Results>
</TestRun>`;

const PASSED_TRX = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="SmokeFeature.SystemIsReady" outcome="Passed" duration="00:00:00.5000000" />
  </Results>
</TestRun>`;

const PENDING_STEPS_LOG = [
  "Test run for /repo/bin/Debug/net8.0/App.dll",
  "Reqnroll.xUnit.ReqnrollPlugin.XUnitPendingStepException : Test pending: No matching step definition",
  "in Login.feature:line 12",
  "Failed!  - Failed:   6, Passed:     0, Skipped:     0, Total:     6",
].join("\n");

function writeTemp(content: string, suffix: string): string {
  const file = path.join(
    os.tmpdir(),
    `bdd-pilot-failure-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
  );
  fs.writeFileSync(file, content, "utf8");
  return file;
}

describe("failureSnapshotFromArtifacts", () => {
  it("detects failures from TRX and log", () => {
    const trxSummary = parseTrx(FAILED_TRX);
    assert.strictEqual(hasFailureContext(trxSummary, ""), true);
    assert.strictEqual(hasFailureContext(parseTrx(PASSED_TRX), ""), false);
    assert.strictEqual(hasFailureContext(undefined, PENDING_STEPS_LOG), true);
    assert.strictEqual(hasFailureContext(undefined, "Passed!  - Failed: 0, Passed: 10, Skipped: 0, Total: 10"), false);
  });

  it("builds snapshot from TRX with mapped failed scenario", () => {
    const trxPath = writeTemp(FAILED_TRX, ".trx");
    try {
      const snapshot = buildFailureSnapshotFromArtifacts({
        projectDir: sampleDir,
        trxPath,
      });
      assert.strictEqual(snapshot.stage, "cli");
      assert.strictEqual(snapshot.mode, "cli");
      assert.deepStrictEqual(snapshot.scopeLabels, ["cli (headless)"]);
      assert.strictEqual(snapshot.summary.failed, 1);
      assert.strictEqual(snapshot.summary.passed, 1);
      assert.strictEqual(snapshot.failedScenarios.length, 1);
      assert.strictEqual(snapshot.failedScenarios[0].scenarioName, "System is ready");
      assert.match(snapshot.failedScenarios[0].featurePath, /Smoke\.feature$/);
      assert.strictEqual(snapshot.evidence.length, 0);
    } finally {
      fs.unlinkSync(trxPath);
    }
  });

  it("builds snapshot from log-only pending steps", () => {
    const logPath = writeTemp(PENDING_STEPS_LOG, ".log");
    try {
      const snapshot = buildFailureSnapshotFromArtifacts({
        projectDir: sampleDir,
        logPath,
      });
      assert.strictEqual(snapshot.summary.failed, 6);
      assert.ok(snapshot.outputForAnalysis.includes("PENDING_STEPS") || snapshot.outputForAnalysis.includes("pending"));
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("throws NoFailureContextError when TRX and log are clean", () => {
    const trxPath = writeTemp(PASSED_TRX, ".trx");
    const logPath = writeTemp("Passed!  - Failed: 0, Passed: 10, Skipped: 0, Total: 10", ".log");
    try {
      assert.throws(
        () =>
          buildFailureSnapshotFromArtifacts({
            projectDir: sampleDir,
            trxPath,
            logPath,
          }),
        NoFailureContextError,
      );
    } finally {
      fs.unlinkSync(trxPath);
      fs.unlinkSync(logPath);
    }
  });

  it("produces markdown with Run section and sanitized output", () => {
    const logPath = writeTemp(PENDING_STEPS_LOG, ".log");
    try {
      const snapshot = buildFailureSnapshotFromArtifacts({
        projectDir: sampleDir,
        logPath,
      });
      const markdown = buildAiFailureContext(snapshot, { maxOutputLines: 80 });
      assert.match(markdown, /## Run/);
      assert.match(markdown, /PENDING_STEPS/);
      assert.ok(!markdown.includes("password="));
    } finally {
      fs.unlinkSync(logPath);
    }
  });
});
