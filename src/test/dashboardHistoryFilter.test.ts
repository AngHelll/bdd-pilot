import * as assert from "assert";
import { describe, it } from "node:test";
import {
  DEFAULT_DASHBOARD_HISTORY_FILTER,
  filterRunHistory,
  listHistoryStages,
  parseDashboardHistoryFilterMessage,
} from "../core/results/dashboardHistoryFilter";
import { RunHistoryEntry } from "../core/results/runHistory";

function entry(partial: Partial<RunHistoryEntry> & Pick<RunHistoryEntry, "id" | "stage">): RunHistoryEntry {
  return {
    timestamp: 1,
    mode: "parallel",
    passed: 1,
    failed: 0,
    skipped: 0,
    total: 1,
    scenarios: [],
    ...partial,
  };
}

describe("dashboardHistoryFilter", () => {
  const history: RunHistoryEntry[] = [
    entry({ id: "1", stage: "test", passed: 2, failed: 0, total: 2, runKind: "run" }),
    entry({ id: "2", stage: "stg", passed: 1, failed: 1, total: 2, runKind: "debug" }),
    entry({
      id: "3",
      stage: "test",
      passed: 0,
      failed: 0,
      skipped: 1,
      total: 1,
      status: "canceled",
      runKind: "run",
    }),
    entry({ id: "4", stage: "prod", passed: 3, failed: 0, total: 3, runKind: "profile" }),
  ];

  it("filters by stage", () => {
    const filtered = filterRunHistory(history, { stage: "test", outcome: "all", runKind: "all" });
    assert.deepStrictEqual(
      filtered.map((e) => e.id),
      ["1", "3"],
    );
  });

  it("filters any_failure and all_passed", () => {
    assert.deepStrictEqual(
      filterRunHistory(history, { outcome: "any_failure", runKind: "all" }).map((e) => e.id),
      ["2"],
    );
    assert.deepStrictEqual(
      filterRunHistory(history, { outcome: "all_passed", runKind: "all" }).map((e) => e.id),
      ["1", "4"],
    );
  });

  it("filters canceled and runKind", () => {
    assert.deepStrictEqual(
      filterRunHistory(history, { outcome: "canceled", runKind: "all" }).map((e) => e.id),
      ["3"],
    );
    assert.deepStrictEqual(
      filterRunHistory(history, { outcome: "all", runKind: "debug" }).map((e) => e.id),
      ["2"],
    );
  });

  it("listHistoryStages newest-first unique", () => {
    assert.deepStrictEqual(listHistoryStages(history), ["prod", "test", "stg"]);
  });

  it("parseDashboardHistoryFilterMessage", () => {
    assert.strictEqual(parseDashboardHistoryFilterMessage({ type: "other" }), undefined);
    const f = parseDashboardHistoryFilterMessage({
      type: "filterHistory",
      stage: "stg",
      outcome: "any_failure",
      runKind: "debug",
    });
    assert.deepStrictEqual(f, {
      stage: "stg",
      outcome: "any_failure",
      runKind: "debug",
    });
    assert.deepStrictEqual(DEFAULT_DASHBOARD_HISTORY_FILTER.outcome, "all");
  });
});
