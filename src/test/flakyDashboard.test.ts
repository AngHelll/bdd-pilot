import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildFlakyDashboardRows,
  lastScenarioFailureMessage,
  parseFlakyOpenMessage,
} from "../core/results/flakyDashboard";
import { RunHistoryEntry, scenarioHistoryKey } from "../core/results/runHistory";

describe("flakyDashboard", () => {
  const featurePath = "/repo/Features/Smoke.feature";
  const scenarioLine = 12;
  const scenarioName = "Flaky login";
  const key = scenarioHistoryKey(featurePath, scenarioLine, scenarioName);

  it("lastScenarioFailureMessage returns most recent failure in window", () => {
    const history = [
      makeEntry("1", key, "failed", "first error"),
      makeEntry("2", key, "passed"),
      makeEntry("3", key, "failed", "latest error"),
    ];
    assert.strictEqual(lastScenarioFailureMessage(history, key), "latest error");
  });

  it("lastScenarioFailureMessage sanitizes secrets in snippet", () => {
    const history = [
      makeEntry("1", key, "failed"),
      makeEntry("2", key, "failed", "password=supersecret leaked"),
    ];
    const snippet = lastScenarioFailureMessage(history, key);
    assert.ok(snippet);
    assert.doesNotMatch(snippet!, /supersecret/);
    assert.match(snippet!, /REDACTED/i);
  });

  it("buildFlakyDashboardRows sorts by failure rate and caps at maxRows", () => {
    const keyHigh = scenarioHistoryKey("/a.feature", 1, "High");
    const keyLow = scenarioHistoryKey("/b.feature", 2, "Low");
    const history = [
      makeEntry("1", keyHigh, "failed"),
      makeEntry("2", keyHigh, "failed"),
      makeEntry("3", keyHigh, "passed"),
      makeEntry("4", keyLow, "failed"),
      makeEntry("5", keyLow, "passed"),
    ];
    const rows = buildFlakyDashboardRows(history);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0]!.scenarioName, "High");
    assert.ok(rows[0]!.failureRate > rows[1]!.failureRate);
  });

  it("buildFlakyDashboardRows sets canOpen false when feature path missing", () => {
    const legacyKey = scenarioHistoryKey("", 0, "Orphan");
    const history = [
      makeEntry("1", legacyKey, "failed"),
      makeEntry("2", legacyKey, "passed"),
    ];
    const rows = buildFlakyDashboardRows(history);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]!.canOpen, false);
  });

  it("buildFlakyDashboardRows includes average duration and open metadata", () => {
    const history = [
      makeEntry("1", key, "failed", "err", 100),
      makeEntry("2", key, "passed", undefined, 200),
    ];
    const rows = buildFlakyDashboardRows(history);
    assert.strictEqual(rows[0]!.averageDurationMs, 150);
    assert.strictEqual(rows[0]!.canOpen, true);
    assert.strictEqual(rows[0]!.featurePath, featurePath);
    assert.strictEqual(rows[0]!.scenarioLine, scenarioLine);
  });

  it("parseFlakyOpenMessage accepts valid openFlakyScenario payload", () => {
    assert.deepStrictEqual(parseFlakyOpenMessage({
      command: "openFlakyScenario",
      featurePath: "/f.feature",
      scenarioLine: 5,
    }), {
      featurePath: "/f.feature",
      scenarioLine: 5,
    });
  });

  it("parseFlakyOpenMessage rejects unknown commands and invalid payloads", () => {
    assert.strictEqual(parseFlakyOpenMessage({ command: "rerunFailed" }), undefined);
    assert.strictEqual(parseFlakyOpenMessage({
      command: "openFlakyScenario",
      featurePath: "",
      scenarioLine: 1,
    }), undefined);
    assert.strictEqual(parseFlakyOpenMessage({
      command: "openFlakyScenario",
      featurePath: "/f.feature",
      scenarioLine: 0,
    }), undefined);
  });
});

function makeEntry(
  id: string,
  key: string,
  outcome: "passed" | "failed",
  errorMessage?: string,
  durationMs = 50,
): RunHistoryEntry {
  const meta = parseKey(key);
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
        featurePath: meta.featurePath,
        scenarioLine: meta.scenarioLine,
        scenarioName: meta.scenarioName,
        outcome,
        durationMs,
        errorMessage,
      },
    ],
  };
}

function parseKey(key: string): {
  featurePath: string;
  scenarioLine: number;
  scenarioName: string;
} {
  const parts = key.split("::");
  const scenarioName = parts.pop() ?? "s";
  const lineStr = parts.pop() ?? "0";
  const featurePath = parts.join("::");
  return {
    featurePath,
    scenarioLine: Number(lineStr) || 0,
    scenarioName,
  };
}
