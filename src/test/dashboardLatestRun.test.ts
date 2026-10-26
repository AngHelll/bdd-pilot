import * as assert from "assert";
import { describe, it } from "node:test";
import {
  presentHistoryTotalsLine,
  presentLatestRun,
  reliableRunDurationMs,
} from "../core/results/dashboardLatestRun";
import { computeDashboardTotals } from "../core/results/dashboardFormat";
import { RunHistoryEntry } from "../core/results/runHistory";

function entry(partial: Partial<RunHistoryEntry> & Pick<RunHistoryEntry, "id">): RunHistoryEntry {
  return {
    timestamp: 1,
    stage: "test",
    mode: "debug",
    passed: 1,
    failed: 0,
    skipped: 0,
    total: 1,
    scenarios: [],
    ...partial,
  };
}

describe("dashboardLatestRun", () => {
  it("does not invent a latest run without a snapshot", () => {
    assert.strictEqual(presentLatestRun(undefined), undefined);
  });

  it("uses the snapshot counts even when history totals differ", () => {
    const history = [
      entry({ id: "old", timestamp: 1, passed: 10, failed: 4, skipped: 0, total: 14 }),
      entry({ id: "new", timestamp: 2, passed: 1, failed: 0, skipped: 0, total: 1, durationMs: 1600 }),
    ];
    const latest = presentLatestRun({
      passed: 1,
      failed: 2,
      skipped: 3,
      provenance: "fromLiveSession",
    });
    assert.strictEqual(latest?.passed, 1);
    assert.strictEqual(latest?.failed, 2);
    assert.strictEqual(latest?.skipped, 3);
    assert.strictEqual(latest?.durationLabel, undefined);
    assert.strictEqual(latest?.provenance, "fromLiveSession");

    const totals = computeDashboardTotals(history);
    assert.strictEqual(
      presentHistoryTotalsLine(totals, "en"),
      "History · 2 runs · 11 passed · 4 failed",
    );
    assert.notStrictEqual(latest?.passed, totals.passed);
  });

  it("shows a recorded duration, including zero, and drops invalid ones", () => {
    assert.strictEqual(reliableRunDurationMs(undefined), undefined);
    assert.strictEqual(reliableRunDurationMs(Number.NaN), undefined);
    assert.strictEqual(reliableRunDurationMs(-1), undefined);
    assert.strictEqual(reliableRunDurationMs(0), 0);

    assert.strictEqual(
      presentLatestRun({
        passed: 1,
        failed: 0,
        skipped: 0,
        provenance: "fromHistory",
        durationMs: 0,
        historyTimestamp: 5,
      })?.durationLabel,
      "0 ms",
    );
    assert.strictEqual(
      presentLatestRun({
        passed: 1,
        failed: 0,
        skipped: 0,
        provenance: "fromHistory",
        durationMs: 1600,
      })?.durationLabel,
      "1.6 s",
    );
    assert.strictEqual(
      presentLatestRun({
        passed: 0,
        failed: 0,
        skipped: 0,
        provenance: "fromRehydrate",
        durationMs: Number.NaN,
      })?.durationLabel,
      undefined,
    );
  });

  it("labels canceled runs inside the historical line", () => {
    const totals = computeDashboardTotals([
      entry({ id: "c", status: "canceled", passed: 3, failed: 1, total: 4 }),
    ]);
    assert.strictEqual(
      presentHistoryTotalsLine(totals, "en"),
      "History · 1 run · 0 passed · 0 failed · 1 canceled",
    );
    assert.strictEqual(presentHistoryTotalsLine({ runs: 0, passed: 0, failed: 0, canceled: 0 }, "en"), undefined);
  });
});
