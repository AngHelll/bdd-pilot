import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildScenarioHistoryView,
  formatScenarioHistoryPickLabel,
} from "../core/results/scenarioHistoryView";
import { RunHistoryEntry, scenarioHistoryKey } from "../core/results/runHistory";

function entry(
  id: string,
  timestamp: number,
  scenarios: RunHistoryEntry["scenarios"],
  extra?: Partial<RunHistoryEntry>,
): RunHistoryEntry {
  return {
    id,
    timestamp,
    stage: "test",
    mode: "parallel",
    passed: scenarios.filter((s) => s.outcome === "passed").length,
    failed: scenarios.filter((s) => s.outcome === "failed").length,
    skipped: 0,
    total: scenarios.length,
    scenarios,
    ...extra,
  };
}

describe("scenarioHistoryView", () => {
  const featurePath = "/f.feature";
  const key = scenarioHistoryKey(featurePath, 10, "Login");

  it("returns newest-first rows for matching scenario", () => {
    const history = [
      entry("1", 1000, [
        {
          featurePath,
          scenarioLine: 10,
          scenarioName: "Login",
          outcome: "passed",
          durationMs: 50,
        },
      ]),
      entry("2", 2000, [
        {
          featurePath,
          scenarioLine: 10,
          scenarioName: "Login",
          outcome: "failed",
          errorMessage: "boom",
          durationMs: 80,
        },
      ], { runKind: "debug", stage: "stg" }),
    ];
    const view = buildScenarioHistoryView(history, key);
    assert.strictEqual(view.rows.length, 2);
    assert.strictEqual(view.rows[0].entryId, "2");
    assert.strictEqual(view.rows[0].outcome, "failed");
    assert.strictEqual(view.rows[0].runKind, "debug");
    assert.strictEqual(view.rows[0].stage, "stg");
    assert.ok(view.rows[0].errorSnippet?.includes("boom"));
    assert.strictEqual(view.usedParentFallback, false);
  });

  it("returns empty view when no history", () => {
    const view = buildScenarioHistoryView([], key, {
      featurePath,
      scenarioName: "Login",
    });
    assert.strictEqual(view.rows.length, 0);
    assert.strictEqual(view.scenarioName, "Login");
  });

  it("falls back to parent scenario name for outline-style key miss", () => {
    const parentKey = scenarioHistoryKey(featurePath, 8, "Login");
    const history = [
      entry("1", 1000, [
        {
          featurePath,
          scenarioLine: 8,
          scenarioName: "Login",
          outcome: "passed",
        },
      ]),
    ];
    const outlineKey = scenarioHistoryKey(featurePath, 12, "Login · row");
    const view = buildScenarioHistoryView(history, outlineKey, {
      featurePath,
      scenarioName: "Login",
    });
    assert.strictEqual(view.usedParentFallback, true);
    assert.strictEqual(view.key, parentKey);
    assert.strictEqual(view.rows.length, 1);
  });

  it("formatScenarioHistoryPickLabel includes outcome", () => {
    const label = formatScenarioHistoryPickLabel({
      entryId: "1",
      timestamp: Date.parse("2026-07-20T12:00:00Z"),
      stage: "test",
      runKind: "run",
      outcome: "failed",
      status: "completed",
    });
    assert.ok(label.includes("failed"));
    assert.ok(label.includes("test"));
  });
});
