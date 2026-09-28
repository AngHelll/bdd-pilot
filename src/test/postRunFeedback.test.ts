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

  it("simple failure is a short action line without counts or diagnostic", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 2, passed: 5, total: 7 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    assert.strictEqual(vm!.message, "2 failed");
    assert.ok(!vm!.message.includes("passed"));
    assert.ok(!vm!.message.includes("step definition"));
    assert.ok(vm!.actions.includes("showOutput"));
    assert.ok(vm!.actions.includes("jumpToFailure"));
    assert.ok(vm!.actions.includes("rerunFailed"));
    assert.strictEqual(vm!.severity, "warning");
  });

  it("short failure line is localized", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      locale: "es",
      summary: summary({ failed: 2, passed: 5, total: 7 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
    });
    assert.strictEqual(vm?.message, "2 fallidos");
  });

  it("failure with triage is the review-first hint only", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 3, passed: 1, total: 4 }),
      outputBuffer: SIMPLE_FAILURE_OUTPUT,
      exitCode: 1,
      failureTriage: {
        topBucket: "pending",
        counts: { pending: 2, assert: 1 },
        orderedBuckets: [
          { bucket: "pending", count: 2 },
          { bucket: "assert", count: 1 },
        ],
      },
    });
    assert.ok(vm);
    assert.strictEqual(vm!.message, "Review first: pending (2)");
    assert.ok(!vm!.message.includes("3 failed"));
    assert.ok(!vm!.message.includes("\n"));
  });

  it("pending steps stay out of the failure toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 6, passed: 0, total: 6 }),
      outputBuffer: PENDING_STEPS_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    assert.strictEqual(vm!.message, "6 failed");
    assert.ok(!/pending or missing step/i.test(vm!.message));
    assert.ok(vm!.actions.includes("rerunFailed"));
    assert.ok(vm!.actions.includes("jumpToFailure"));
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

  it("always mode with failures is still one short line", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      toastMode: "always",
      summary: summary({ failed: 6, passed: 0, total: 6 }),
      outputBuffer: PENDING_STEPS_OUTPUT,
      exitCode: 1,
    });
    assert.ok(vm);
    assert.strictEqual(vm!.message, "6 failed");
    assert.strictEqual(vm!.message.includes("\n"), false);
  });

  it("infra with counts and no diagnostic is the fallback line only", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 0, passed: 3, skipped: 0, total: 3 }),
      outputBuffer: "",
      exitCode: 1,
    });
    assert.ok(vm);
    assert.match(vm!.message, /did not complete successfully/);
    assert.ok(!vm!.message.includes("passed"));
    assert.strictEqual(vm!.severity, "error");
  });

  it("infra with counts and a diagnostic is that line only", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      summary: summary({ failed: 0, passed: 3, skipped: 0, total: 3 }),
      outputBuffer: SDK_MISSING_OUTPUT,
      exitCode: 145,
    });
    assert.ok(vm);
    assert.match(vm!.message, /SDK 8\.0\.418/);
    assert.ok(!vm!.message.includes("passed"));
    assert.ok(!vm!.message.includes("\n"));
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

  it("cancel without expected shows generic toast", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      canceled: true,
      outputBuffer: "",
      exitCode: null,
    });
    assert.ok(vm);
    assert.strictEqual(vm!.message, "Run canceled.");
    assert.strictEqual(vm!.actions.length, 0);
  });

  it("cancel with zero completed shows partial ratio", () => {
    const vm = buildPostRunFeedback({
      ...baseInput,
      canceled: true,
      cancelProgress: { completed: 0, expected: 19 },
      outputBuffer: "",
      exitCode: null,
    });
    assert.ok(vm);
    assert.match(vm!.message, /0\/19/);
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
