import * as assert from "assert";
import { describe, it } from "node:test";
import { Diagnostic } from "../core/diagnostics/analyzer";
import { pickPrimaryDiagnostic } from "../core/diagnostics/primaryDiagnostic";

function diag(code: string): Diagnostic {
  return {
    code,
    severity: "error",
    title: code,
    hint: "hint",
  };
}

describe("pickPrimaryDiagnostic", () => {
  it("returns undefined for empty list", () => {
    assert.strictEqual(pickPrimaryDiagnostic([]), undefined);
  });

  it("skips TEST_RUN_FAILED when other diagnostics exist", () => {
    const primary = pickPrimaryDiagnostic([diag("TEST_RUN_FAILED"), diag("PENDING_STEPS")]);
    assert.strictEqual(primary?.code, "PENDING_STEPS");
  });

  it("falls back to TEST_RUN_FAILED when it is the only diagnostic", () => {
    const primary = pickPrimaryDiagnostic([diag("TEST_RUN_FAILED")]);
    assert.strictEqual(primary?.code, "TEST_RUN_FAILED");
  });

  it("returns first diagnostic when none are TEST_RUN_FAILED", () => {
    const primary = pickPrimaryDiagnostic([diag("SDK_NOT_FOUND"), diag("PENDING_STEPS")]);
    assert.strictEqual(primary?.code, "SDK_NOT_FOUND");
  });
});
