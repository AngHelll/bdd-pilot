import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildPilotSummaryViewModel,
  formatPilotSummaryLabel,
} from "../core/results/pilotSummaryViewModel";

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
});
