import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildPilotSummaryViewModel,
  formatFilterChipDescription,
  formatPilotSummaryDescription,
  formatPilotSummaryLabel,
  formatStoreFailureChip,
  formatSummaryDiagnosticChip,
  formatSummaryDiagnosticTooltip,
  resolvePilotSummaryCommand,
  resolvePilotSummaryIcon,
  resolveSummaryDiagnostic,
  PILOT_SUMMARY_CANCEL_COMMAND,
  PILOT_SUMMARY_DASHBOARD_COMMAND,
} from "../core/results/pilotSummaryViewModel";
import { LiveProgressParser } from "../core/runner/liveProgress";
import { Diagnostic } from "../core/diagnostics/analyzer";
import { t } from "../core/i18n";

describe("pilotSummaryViewModel", () => {
  it("buildPilotSummaryViewModel returns empty snapshot when no data", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
    });
    assert.strictEqual(vm.lastKnown, undefined);
    assert.strictEqual(vm.running, false);
  });

  it("buildPilotSummaryViewModel includes store rollup and running flag", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 2, failed: 1, skipped: 0, withResults: 3 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
    });
    assert.strictEqual(vm.lastKnown?.passed, 2);
    assert.strictEqual(vm.lastKnown?.failed, 1);
    assert.strictEqual(vm.lastKnown?.provenance, "fromLiveSession");
    assert.strictEqual(vm.running, true);
  });

  it("buildPilotSummaryViewModel marks rehydrate provenance", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 1, failed: 0, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: {
        trxFileName: "bdd-pilot-1.trx",
        mtimeMs: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
      },
      running: false,
    });
    assert.strictEqual(vm.lastKnown?.provenance, "fromRehydrate");
    assert.strictEqual(vm.rehydrateNotice?.trxFileName, "bdd-pilot-1.trx");
  });

  it("formatPilotSummaryLabel shows empty hint when no results", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.includes("Run Gherkin scenarios"));
    assert.ok(!label.includes("command:"));
  });

  it("formatPilotSummaryLabel uses no_features copy when emptyKind is no_features", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      emptyKind: "no_features",
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.includes("No .feature files found"));
    assert.ok(!label.includes("Run Gherkin scenarios"));
  });

  it("formatPilotSummaryLabel prefers rollup over emptyKind when lastKnown exists", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 1, failed: 0, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      emptyKind: "no_features",
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.includes("1 passed"));
    assert.ok(!label.includes("No .feature files"));
  });

  it("formatPilotSummaryLabel shows running without global rollup during run", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 5, failed: 2, skipped: 0, withResults: 7 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.startsWith("Running Gherkin…"));
    assert.ok(!label.includes("2 failed"));
    assert.ok(!label.includes("5 passed"));
  });

  it("formatPilotSummaryLabel appends live progress while running", () => {
    const parser = new LiveProgressParser(8);
    parser.feed("[xUnit.net]     Passed A.Test1 [1 ms]\n");
    parser.feed("[xUnit.net]     Passed A.Test2 [1 ms]\n");
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 17, failed: 0, skipped: 0, withResults: 17 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      liveProgress: parser.getState(),
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.startsWith("Running Gherkin…"));
    assert.ok(label.includes("2/8"));
    assert.ok(!label.includes("17 passed"));
  });

  it("formatPilotSummaryLabel appends rehydrate suffix without filename", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 1, failed: 0, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: {
        trxFileName: "bdd-pilot-very-long-name-here.trx",
        mtimeMs: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
      },
      running: false,
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.includes("Restored (not a new run)"));
    assert.ok(!label.includes("bdd-pilot-very-long"));
  });

  it("formatPilotSummaryLabel combines running, rollup, and rehydrate", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 99, failed: 99, skipped: 99, withResults: 297 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: {
        trxFileName: "x.trx",
        mtimeMs: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
      },
      running: true,
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.includes("Running Gherkin…"));
    assert.ok(label.includes("Restored (not a new run)"));
    assert.ok(label.length <= 160);
  });

  it("resolvePilotSummaryIcon returns history, spin, debug-alt, or diagnostic severity", () => {
    assert.strictEqual(resolvePilotSummaryIcon(false, false), "history");
    assert.strictEqual(resolvePilotSummaryIcon(true, false), "loading~spin");
    assert.strictEqual(resolvePilotSummaryIcon(true, true), "debug-alt");
    const errorDiag: Diagnostic = {
      code: "PENDING_STEPS",
      severity: "error",
      title: "Pending",
      hint: "hint",
    };
    assert.strictEqual(resolvePilotSummaryIcon(false, false, errorDiag), "warning");
    const warnDiag: Diagnostic = { ...errorDiag, severity: "warning" };
    assert.strictEqual(resolvePilotSummaryIcon(false, false, warnDiag), "info");
    assert.strictEqual(resolvePilotSummaryIcon(false, false, undefined, true), "warning");
    assert.strictEqual(resolvePilotSummaryIcon(true, false, errorDiag), "loading~spin");
  });

  it("resolvePilotSummaryCommand uses cancel while running", () => {
    const running = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      searchQuery: "ignored-while-running",
    });
    const cancelCmd = resolvePilotSummaryCommand(running, "en");
    assert.strictEqual(cancelCmd.command, PILOT_SUMMARY_CANCEL_COMMAND);
    assert.ok(cancelCmd.title.toLowerCase().includes("cancel"));

    const idle = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
    });
    assert.strictEqual(resolvePilotSummaryCommand(idle, "en").command, PILOT_SUMMARY_DASHBOARD_COMMAND);
  });

  it("run-in-progress toast mentions cancel affordance (en/es)", () => {
    const en = t("en", "toast.runInProgress");
    const es = t("es", "toast.runInProgress");
    assert.ok(/cancel/i.test(en));
    assert.ok(/toolbar|summary/i.test(en));
    assert.ok(/cancela/i.test(es));
  });

  it("resolveSummaryDiagnostic hides diagnostic while running", () => {
    const diag: Diagnostic = {
      code: "SDK_NOT_FOUND",
      severity: "error",
      title: "SDK missing",
      hint: "hint",
    };
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      topDiagnostic: diag,
    });
    assert.strictEqual(resolveSummaryDiagnostic(vm), undefined);
    assert.strictEqual(vm.topDiagnostic, undefined);
  });

  it("formatSummaryDiagnosticChip truncates long titles", () => {
    const diag: Diagnostic = {
      code: "X",
      severity: "error",
      title: "a".repeat(60),
      hint: "hint",
    };
    const chip = formatSummaryDiagnosticChip(diag, "en");
    assert.ok(chip.startsWith("⚠ "));
    assert.ok(chip.includes("…"));
  });

  it("formatSummaryDiagnosticTooltip includes code, title, hint, and detail", () => {
    const diag: Diagnostic = {
      code: "PENDING_STEPS",
      severity: "error",
      title: "Pending step definitions",
      detail: "line detail",
      hint: "Add bindings",
    };
    const tooltip = formatSummaryDiagnosticTooltip(diag, "en");
    assert.ok(tooltip.includes("PENDING_STEPS"));
    assert.ok(tooltip.includes("Pending step definitions"));
    assert.ok(tooltip.includes("Add bindings"));
    assert.ok(tooltip.startsWith("line detail"));
  });

  it("formatFilterChipDescription shows truncated filter chip", () => {
    const chip = formatFilterChipDescription("smoke", "en");
    assert.ok(chip.includes("Filter:"));
    assert.ok(chip.includes("smoke"));
    const long = "a".repeat(50);
    const truncated = formatFilterChipDescription(long, "en");
    assert.ok(truncated.includes("…"));
    assert.ok(truncated.length < long.length + 20);
  });

  it("formatPilotSummaryDescription shows live progress while running", () => {
    const parser = new LiveProgressParser(2);
    parser.feed("[xUnit.net]     Passed A.Test1 [1 ms]\n");
    parser.feed("[xUnit.net]     Failed A.Test2 [2 ms]\n");
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 1, failed: 1, skipped: 0, withResults: 2 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      liveProgress: parser.getState(),
    });
    const description = formatPilotSummaryDescription(vm, "en");
    assert.ok(description?.includes("2"));
    assert.ok(description?.includes("failed"));
  });

  it("formatPilotSummaryDescription prefers live progress over filter while running", () => {
    const parser = new LiveProgressParser(1);
    parser.feed("[xUnit.net]     Passed A.Test1 [1 ms]\n");
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      searchQuery: "@smoke",
      liveProgress: parser.getState(),
    });
    const description = formatPilotSummaryDescription(vm, "en");
    assert.ok(description && !description.includes("Filter:"));
    assert.ok(description?.includes("1") || description?.includes("passed"));
  });

  it("formatPilotSummaryDescription idle prefers unmapped over filter", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      searchQuery: "@smoke",
      unmappedCount: 2,
      stage: "test",
    });
    assert.strictEqual(formatPilotSummaryDescription(vm, "en"), "2 unmapped — Show Unmapped");
  });

  it("formatPilotSummaryDescription shows 0/N before first test completes", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      liveProgress: new LiveProgressParser(12).getState(),
    });
    assert.strictEqual(formatPilotSummaryDescription(vm, "en"), "0/12");
  });

  it("formatPilotSummaryDescription hides live progress when no expected and completed zero", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
      liveProgress: new LiveProgressParser().getState(),
    });
    assert.strictEqual(formatPilotSummaryDescription(vm, "en"), undefined);
  });

  it("formatPilotSummaryDescription shows diagnostic chip when idle", () => {
    const diag: Diagnostic = {
      code: "SDK_NOT_FOUND",
      severity: "error",
      title: "SDK missing",
      hint: "hint",
    };
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      topDiagnostic: diag,
    });
    const description = formatPilotSummaryDescription(vm, "en");
    assert.ok(description?.includes("SDK missing"));
  });

  it("formatPilotSummaryDescription shows store failure chip when no diagnostic", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 0, failed: 1, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      storeFailureSnippet: "Expected true but was false",
    });
    const description = formatPilotSummaryDescription(vm, "en");
    assert.strictEqual(description, formatStoreFailureChip("Expected true but was false", "en"));
  });

  it("formatPilotSummaryDescription shows unmapped chip when idle without diagnostic", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 1, failed: 0, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      unmappedCount: 3,
    });
    assert.strictEqual(formatPilotSummaryDescription(vm, "en"), "3 unmapped — Show Unmapped");
  });

  it("formatPilotSummaryDescription prefers unmapped over diagnostic chip", () => {
    const diag = {
      code: "SDK_MISSING",
      severity: "error" as const,
      title: "SDK missing",
      hint: "Install SDK",
    };
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 0, failed: 1, skipped: 0, withResults: 1 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      topDiagnostic: diag,
      unmappedCount: 2,
    });
    const description = formatPilotSummaryDescription(vm, "en");
    assert.strictEqual(description, "2 unmapped — Show Unmapped");
  });

  it("formatPilotSummaryDescription falls back to STAGE chip", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: undefined,
      storeNonEmpty: false,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: false,
      stage: "stg",
    });
    assert.strictEqual(formatPilotSummaryDescription(vm, "en"), "STAGE: stg");
  });

  it("cockpit copy keys mention Gherkin (en)", () => {
    assert.ok(/Gherkin/i.test(t("en", "tree.summaryRunning")));
    assert.ok(/Gherkin/i.test(t("en", "dashboard.recentRuns")));
    assert.ok(/cockpit|Gherkin/i.test(t("en", "statusBar.hubTooltipTitle")));
  });
});