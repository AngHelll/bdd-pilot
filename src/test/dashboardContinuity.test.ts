import * as assert from "assert";
import { describe, it } from "node:test";
import {
  computeDashboardTotals,
  formatHistoryScopeDisplay,
  truncateScopeFilter,
} from "../core/results/dashboardFormat";
import { RUN_SCOPE_ALL_TESTS_LABEL } from "../core/diagnostics/aiFailureContext";
import { resolveLastKnownSnapshot } from "../core/results/dashboardLastKnown";
import { RunHistoryEntry, flakyRate, scenarioHistoryKey } from "../core/results/runHistory";

describe("dashboard continuity", () => {
  it("computeDashboardTotals excludes canceled passed/failed from KPI sums", () => {
    const history: RunHistoryEntry[] = [
      makeEntry("1", { passed: 2, failed: 0, status: "completed" }),
      makeEntry("2", { passed: 5, failed: 1, status: "canceled" }),
    ];
    const totals = computeDashboardTotals(history);
    assert.strictEqual(totals.runs, 2);
    assert.strictEqual(totals.passed, 2);
    assert.strictEqual(totals.failed, 0);
    assert.strictEqual(totals.canceled, 1);
  });

  it("truncateScopeFilter shortens long filters", () => {
    const long = "FullyQualifiedName~" + "x".repeat(50);
    const truncated = truncateScopeFilter(long, 40);
    assert.strictEqual(truncated.length, 40);
    assert.ok(truncated.endsWith("…"));
  });

  it("formatHistoryScopeDisplay shows All tests for full-suite runs", () => {
    const entry = makeEntry("1", { scopeLabel: RUN_SCOPE_ALL_TESTS_LABEL });
    assert.strictEqual(formatHistoryScopeDisplay(entry, "en"), "All tests");
    assert.strictEqual(formatHistoryScopeDisplay(entry, "es"), "Todos los tests");
  });

  it("formatHistoryScopeDisplay prefers scopeLabel over empty filter", () => {
    const entry = makeEntry("1", { scopeLabel: "@smoke (tag)", filter: "" });
    assert.strictEqual(formatHistoryScopeDisplay(entry, "en"), "@smoke (tag)");
  });

  it("formatHistoryScopeDisplay falls back to filter for legacy entries", () => {
    const entry = makeEntry("1", { filter: "Category=smoke" });
    assert.strictEqual(formatHistoryScopeDisplay(entry, "en"), "Category=smoke");
  });

  it("resolveLastKnownSnapshot prefers live store over history", () => {
    const snap = resolveLastKnownSnapshot(
      { passed: 3, failed: 1, skipped: 0, withResults: 4 },
      true,
      makeEntry("h", { passed: 9, failed: 0 }),
      undefined,
    );
    assert.deepStrictEqual(snap, {
      passed: 3,
      failed: 1,
      skipped: 0,
      provenance: "fromLiveSession",
    });
  });

  it("resolveLastKnownSnapshot uses history when store empty", () => {
    const entry = makeEntry("h", { passed: 1, failed: 2, durationMs: 500, timestamp: 1000 });
    const snap = resolveLastKnownSnapshot(undefined, false, entry, undefined);
    assert.strictEqual(snap?.provenance, "fromHistory");
    assert.strictEqual(snap?.passed, 1);
    assert.strictEqual(snap?.durationMs, 500);
    assert.strictEqual(snap?.historyTimestamp, 1000);
  });

  it("resolveLastKnownSnapshot marks rehydrate provenance", () => {
    const snap = resolveLastKnownSnapshot(
      { passed: 1, failed: 0, skipped: 0, withResults: 1 },
      true,
      undefined,
      {
        trxFileName: "bdd-pilot-1.trx",
        mtimeMs: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
      },
    );
    assert.strictEqual(snap?.provenance, "fromRehydrate");
  });

  it("flakyRate ignores status field on unrelated entries", () => {
    const key = scenarioHistoryKey("/f.feature", 10, "Flaky");
    const history = [
      makeEntry("1", { scenarioKey: key, outcome: "failed", status: "completed" }),
      makeEntry("2", { scenarioKey: key, outcome: "passed", status: "canceled" }),
    ];
    assert.strictEqual(flakyRate(history, key), 0.5);
  });
});

function makeEntry(
  id: string,
  opts: {
    passed?: number;
    failed?: number;
    durationMs?: number;
    timestamp?: number;
    status?: "completed" | "canceled";
    scenarioKey?: string;
    outcome?: "passed" | "failed";
    scopeLabel?: string;
    filter?: string;
  } = {},
): RunHistoryEntry {
  const key = opts.scenarioKey ?? "a::1::s";
  const [featurePath, lineStr, scenarioName] = key.split("::");
  const outcome = opts.outcome ?? "passed";
  return {
    id,
    timestamp: opts.timestamp ?? Date.now(),
    stage: "test",
    mode: "debug",
    scopeLabel: opts.scopeLabel,
    filter: opts.filter,
    passed: opts.passed ?? (outcome === "passed" ? 1 : 0),
    failed: opts.failed ?? (outcome === "failed" ? 1 : 0),
    skipped: 0,
    total: 1,
    durationMs: opts.durationMs,
    status: opts.status,
    scenarios: [
      {
        featurePath: featurePath ?? "/f.feature",
        scenarioLine: Number(lineStr) || 1,
        scenarioName: scenarioName ?? "s",
        outcome,
        durationMs: opts.durationMs ?? 50,
      },
    ],
  };
}
