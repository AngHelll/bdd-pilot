import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildPilotSummaryViewModel,
  formatFilterChipDescription,
  formatPilotSummaryDescription,
  formatPilotSummaryLabel,
  formatSummaryDiagnosticChip,
  formatSummaryDiagnosticTooltip,
  resolvePilotSummaryIcon,
  resolveSummaryDiagnostic,
} from "../core/results/pilotSummaryViewModel";
import { LiveProgressParser } from "../core/runner/liveProgress";
import { Diagnostic } from "../core/diagnostics/analyzer";

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
    assert.ok(label.includes("Run tests from the tree"));
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
    assert.ok(!label.includes("Run tests from the tree"));
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

  it("formatPilotSummaryLabel includes rollup and running prefix", () => {
    const vm = buildPilotSummaryViewModel({
      storeRollup: { passed: 5, failed: 2, skipped: 0, withResults: 7 },
      storeNonEmpty: true,
      lastHistory: undefined,
      rehydrateNotice: undefined,
      running: true,
    });
    const label = formatPilotSummaryLabel(vm, "en");
    assert.ok(label.startsWith("Running…"));
    assert.ok(label.includes("2 failed"));
    assert.ok(label.includes("5 passed"));
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
    assert.ok(label.includes("Running…"));
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
    assert.strictEqual(resolvePilotSummaryIcon(true, false, errorDiag), "loading~spin");
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

  it("formatPilotSummaryDescription prefers filter chip over live progress", () => {
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
    assert.ok(description?.includes("Filter:"));
    assert.ok(description?.includes("smoke"));
  });

  it("formatPilotSummaryDescription hides live progress when completed is zero", () => {
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
});
