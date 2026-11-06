import * as assert from "assert";
import { describe, it } from "node:test";
import {
  presentFirstStoredFailure,
  presentHistoryTotalsLine,
  presentLatestRun,
  reliableRunDurationMs,
} from "../core/results/dashboardLatestRun";
import { ScenarioRunRecord } from "../core/results/runHistory";
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

  it("presents the first stored failure and skips a passed record ahead of it", () => {
    const passed: ScenarioRunRecord = {
      featurePath: "/tmp/pay.feature",
      scenarioLine: 4,
      scenarioName: "Pays on time",
      outcome: "passed",
    };
    const first: ScenarioRunRecord = {
      featurePath: "C:\\proj\\pay.feature",
      scenarioLine: 12,
      scenarioName: 'Add two numbers(first: "5", second: "7", result: "12", exampleTags: [])',
      outcome: "failed",
      durationMs: 1600,
      errorMessage: "Expected <b>5</b>",
    };
    const second: ScenarioRunRecord = {
      featurePath: "/tmp/other.feature",
      scenarioLine: 20,
      scenarioName: "Later",
      outcome: "failed",
      errorMessage: "later",
    };
    const run = entry({
      id: "run",
      failed: 4,
      scenarios: [passed, first, second],
    });
    const card = presentFirstStoredFailure(
      { passed: 1, failed: 2, skipped: 0, provenance: "fromLiveSession" },
      run,
      "en",
    );
    assert.strictEqual(card?.heading, "First stored failure · 1 of 2");
    assert.strictEqual(card?.label, "Add two numbers · first=5, second=7 +1");
    assert.strictEqual(card?.featureBasename, "pay.feature");
    assert.strictEqual(card?.canOpen, true);
    assert.strictEqual(card?.scenarioLine, 12);
    assert.strictEqual(card?.durationLabel, "1.6 s");
    assert.strictEqual(card?.errorSnippet, "Expected <b>5</b>");
    assert.doesNotMatch(card?.label ?? "", /exampleTags/);
    assert.strictEqual(
      presentFirstStoredFailure(
        { passed: 1, failed: 2, skipped: 0, provenance: "fromLiveSession" },
        run,
        "es",
      )?.heading,
      "Primer fallo guardado · 1 de 2",
    );
  });

  it("hides the first failure when counts, records, or provenance do not qualify", () => {
    const failed = entry({
      id: "failed",
      failed: 1,
      scenarios: [
        {
          featurePath: "",
          scenarioLine: 0,
          scenarioName: "Unmapped",
          outcome: "failed",
          durationMs: -1,
          errorMessage: "   ",
        },
      ],
    });
    const visible = presentFirstStoredFailure(
      { passed: 0, failed: 1, skipped: 0, provenance: "fromHistory" },
      failed,
      "en",
    );
    assert.strictEqual(visible?.heading, "First stored failure");
    assert.strictEqual(visible?.canOpen, false);
    assert.strictEqual(visible?.featureBasename, undefined);
    assert.strictEqual(visible?.durationLabel, undefined);
    assert.strictEqual(visible?.errorSnippet, undefined);

    const snapshot = { passed: 0, failed: 1, skipped: 0, provenance: "fromLiveSession" as const };
    assert.strictEqual(presentFirstStoredFailure({ ...snapshot, failed: 0 }, failed, "en"), undefined);
    assert.strictEqual(
      presentFirstStoredFailure(snapshot, entry({ id: "empty", scenarios: [] }), "en"),
      undefined,
    );
    assert.strictEqual(
      presentFirstStoredFailure({ ...snapshot, provenance: "fromRehydrate" }, failed, "en"),
      undefined,
    );
    assert.strictEqual(presentFirstStoredFailure(snapshot, undefined, "en"), undefined);
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
