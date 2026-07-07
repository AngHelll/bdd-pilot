import * as assert from "assert";
import { describe, it } from "node:test";
import { Diagnostic } from "../core/diagnostics/analyzer";
import {
  dashboardDiagnosticSeverityClass,
  formatDashboardDiagnosticLines,
  resolveDashboardPrimaryDiagnostic,
} from "../core/results/dashboardDiagnostic";

function diag(code: string, severity: Diagnostic["severity"] = "error"): Diagnostic {
  return {
    code,
    severity,
    title: `Title ${code}`,
    hint: "custom hint",
  };
}

describe("resolveDashboardPrimaryDiagnostic", () => {
  it("returns undefined while running", () => {
    assert.strictEqual(resolveDashboardPrimaryDiagnostic(true, [diag("PENDING_STEPS")]), undefined);
  });

  it("returns undefined when diagnostics are empty", () => {
    assert.strictEqual(resolveDashboardPrimaryDiagnostic(false, []), undefined);
  });

  it("uses pickPrimaryDiagnostic when not running", () => {
    const primary = resolveDashboardPrimaryDiagnostic(false, [
      diag("TEST_RUN_FAILED"),
      diag("PENDING_STEPS"),
    ]);
    assert.strictEqual(primary?.code, "PENDING_STEPS");
  });
});

describe("formatDashboardDiagnosticLines", () => {
  it("formats title, detail, and hint", () => {
    const lines = formatDashboardDiagnosticLines(
      {
        code: "SDK_NOT_FOUND",
        severity: "error",
        title: "SDK missing",
        detail: "Install .NET 8",
        hint: "Run dotnet --info",
      },
      "en",
    );
    assert.strictEqual(lines.titleLine, "[SDK_NOT_FOUND] SDK missing");
    assert.strictEqual(lines.detailLine, "Install .NET 8");
    assert.strictEqual(lines.hintLine, "Run dotnet --info");
  });

  it("falls back to catalog hint when diagnostic has no hint", () => {
    const lines = formatDashboardDiagnosticLines(
      {
        code: "PENDING_STEPS",
        severity: "warning",
        title: "Pending steps",
        hint: "",
      },
      "en",
    );
    assert.ok(lines.hintLine.length > 0);
    assert.strictEqual(lines.detailLine, undefined);
  });
});

describe("dashboardDiagnosticSeverityClass", () => {
  it("maps warning severity", () => {
    assert.strictEqual(dashboardDiagnosticSeverityClass(diag("X", "warning")), "diag-warning");
  });

  it("maps error severity", () => {
    assert.strictEqual(dashboardDiagnosticSeverityClass(diag("X", "error")), "diag-error");
  });
});
