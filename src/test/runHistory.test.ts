import * as assert from "assert";
import { describe, it } from "node:test";
import {
  RunHistoryEntry,
  averageDuration,
  flakyRate,
  scenarioHistoryKey,
  trimHistory,
} from "../core/results/runHistory";

describe("runHistory", () => {
  const key = scenarioHistoryKey("/f.feature", 10, "My scenario");

  it("trimHistory keeps the most recent entries", () => {
    const entries = [1, 2, 3, 4, 5].map((n) => makeEntry(String(n)));
    assert.deepStrictEqual(trimHistory(entries, 3).map((e) => e.id), ["3", "4", "5"]);
  });

  it("flakyRate returns 0 with fewer than 2 runs", () => {
    const history = [makeEntry("1", key, "failed")];
    assert.strictEqual(flakyRate(history, key), 0);
  });

  it("flakyRate computes failure fraction", () => {
    const history = [
      makeEntry("1", key, "failed"),
      makeEntry("2", key, "passed"),
      makeEntry("3", key, "failed"),
    ];
    assert.strictEqual(flakyRate(history, key), 2 / 3);
  });

  it("averageDuration averages recent durations", () => {
    const history = [
      makeEntry("1", key, "passed", 100),
      makeEntry("2", key, "passed", 200),
    ];
    assert.strictEqual(averageDuration(history, key), 150);
  });
});

function makeEntry(
  id: string,
  key = "a::1::s",
  outcome: "passed" | "failed" = "passed",
  durationMs = 50,
): RunHistoryEntry {
  const [featurePath, lineStr, scenarioName] = key.split("::");
  return {
    id,
    timestamp: Date.now(),
    stage: "test",
    mode: "debug",
    passed: outcome === "passed" ? 1 : 0,
    failed: outcome === "failed" ? 1 : 0,
    skipped: 0,
    total: 1,
    scenarios: [
      {
        featurePath: featurePath ?? "/f.feature",
        scenarioLine: Number(lineStr) || 1,
        scenarioName: scenarioName ?? "s",
        outcome,
        durationMs,
      },
    ],
  };
}
