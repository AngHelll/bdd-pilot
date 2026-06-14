import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildPostRunFeedback,
  findToastDiagnostic,
  PostRunFeedbackInput,
} from "../core/feedback/postRunFeedback";
import { UnifiedSummary } from "../core/results/resultLoader";

const baseInput: Omit<PostRunFeedbackInput, "summary" | "outputBuffer" | "exitCode"> = {
  locale: "en",
  toastMode: "failures",
  canceled: false,
  debug: false,
  canRerunFailed: true,
  canCopyForAi: false,
};

function summary(overrides: Partial<UnifiedSummary>): UnifiedSummary {
  return {
    source: "trx",
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    results: [],
    ...overrides,
  };
}

const SIMPLE_FAILURE_OUTPUT = [
  "Test run for /repo/bin/Debug/net8.0/App.dll",
  "Failed!  - Failed:   2, Passed:     5, Skipped:     0, Total:     7",
].join("\n");

const PENDING_STEPS_OUTPUT = [
  "Test run for /repo/bin/Debug/net8.0/App.dll",
  "Reqnroll.xUnit.ReqnrollPlugin.XUnitPendingStepException : Test pending: No matching step definition",
  "Failed!  - Failed:   6, Passed:     0, Skipped:     0, Total:     6",
].join("\n");

const SDK_MISSING_OUTPUT = [
  "Requested SDK version: 8.0.418",
  "Installed SDKs:",
  "8.0.101 [/usr/local/share/dotnet/sdk]",
].join("\n");

describe("postRunFeedback", () => {
  it("findToastDiagnostic excludes TEST_RUN_FAILED", () => {
    const diag = findToastDiagnostic(SIMPLE_FAILURE_OUTPUT);
    assert.strictEqual(diag?.code, undefined);
    assert.strictEqual(findToastDiagnostic(SIMPLE_FAILURE_OUTPUT), undefined);
  });

  it("simple failure shows count and Re-run Failed without diagnostic line", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 2, passed: 5, total: 7 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    assert.match(vm!.message, /2 failed, 5 passed \(7 total\)/);
    assert.ok(!vm!.message.includes("step definition"));
    assert.ok(!vm!.message.includes("Review failure categories"));
    assert.ok(vm!.actions.includes("showOutput"));
    assert.ok(vm!.actions.includes("rerunFailed"));
    assert.strictEqual(vm!.severity, "warning");
  });

  it("pending steps merges diagnostic into one toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 6, passed: 0, total: 6 }),
      outputBuffer: PENDING_STEPS_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    assert.match(vm!.message, /6 failed/);
    assert.match(vm!.message, /pending or missing step/i);
    assert.ok(vm!.actions.includes("rerunFailed"));
  });

  it("all pass with failures mode shows no toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 0, passed: 3, total: 3 }),
      outputBuffer: "Passed!  - Failed: 0, Passed: 3, Skipped: 0, Total: 3",
      exitCode: 0,
    });
    assert.strictEqual(vm, undefined);
  });

  it("all pass with always mode shows count only", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      toastMode: "always",
      summary: summary({ failed: 0, passed: 3, skipped: 0, total: 3 }),
      outputBuffer: "Passed!  - Failed: 0, Passed: 3, Skipped: 0, Total: 3",
      exitCode: 0,
    });
    assert.ok(vm);
    assert.match(vm!.message, /0 failed, 3 passed/);
    assert.strictEqual(vm!.actions.join(","), "showOutput");
  });

  it("always mode with pending steps is a single toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      toastMode: "always",
      summary: summary({ failed: 6, passed: 0, total: 6 }),
      outputBuffer: PENDING_STEPS_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    const lines = vm!.message.split("\n");
    assert.strictEqual(lines.length, 2);
  });

  it("cancel shows partial progress only", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      canceled: true,
      cancelProgress: { completed: 3, expected: 10 },
      outputBuffer: "",
      exitCode: null,
    });
    assert.ok(vm);
    assert.match(vm!.message, /3\/10/);
    assert.strictEqual(vm!.actions.length, 0);
  });

  it("off mode shows no toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      toastMode: "off",
      summary: summary({ failed: 2, passed: 0, total: 2 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
    });
    assert.strictEqual(vm, undefined);
  });

  it("infra SDK missing shows diagnostic toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: undefined,
      outputBuffer: SDK_MISSING_OUTPUT,
      exitCode: 145,
    });
    assert.ok(vm);
    assert.match(vm!.message, /SDK 8\.0\.418/);
    assert.strictEqual(vm!.severity, "error");
    assert.ok(vm!.actions.includes("showOutput"));
  });

  it("debug produces no toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      debug: true,
      summary: summary({ failed: 1, passed: 0, total: 1 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
    });
    assert.strictEqual(vm, undefined);
  });
});
