import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeStore } from "../providers/outcomeStore";
import { scenarioKey } from "../core/runner/runScope";
import {
  applySkipReasonSnapshot,
  buildSkipReasonSnapshot,
  mappingReportFromSkipSnapshot,
  parseSkipReasonSnapshot,
  shouldRestoreSkipSnapshot,
} from "../core/results/skipReasonSnapshot";
import { applyScopedTrxResults } from "../core/results/trxTreeMapping";
import { UnifiedSummary } from "../core/results/resultLoader";

const domains: DomainGroup[] = [
  {
    name: "General",
    features: [
      {
        name: "Sample",
        filePath: "/x/Sample.feature",
        tags: [],
        scenarios: [
          { name: "One", tags: [], line: 2, isOutline: false },
          { name: "Two", tags: [], line: 5, isOutline: false },
        ],
      },
    ],
  },
];

const feature = domains[0].features[0];

describe("skipReasonSnapshot", () => {
  it("builds snapshot from scoped unmapped leaves", () => {
    const store = new OutcomeStore();
    const summary: UnifiedSummary = {
      source: "trx",
      passed: 1,
      failed: 0,
      skipped: 0,
      total: 1,
      results: [{ testName: "SampleFeature.One", outcome: "passed", durationMs: 10 }],
    };
    const report = applyScopedTrxResults(store, domains, summary, [
      { kind: "feature", feature },
    ]);
    assert.ok(report);
    const snap = buildSkipReasonSnapshot({
      report: report!,
      store,
      trxPath: "/proj/TestResults/bdd-pilot-1.trx",
      now: 1_000,
    });
    assert.ok(snap);
    assert.strictEqual(snap!.entries.length, 1);
    assert.strictEqual(snap!.entries[0]!.outcomeKey, scenarioKey(feature, feature.scenarios[1]!));
    assert.strictEqual(snap!.entries[0]!.reason, "not_in_trx");
    assert.ok(snap!.trxPath?.endsWith("bdd-pilot-1.trx"));
  });

  it("shouldRestore requires matching trx path and age", () => {
    const snap = {
      trxPath: "/a/trx.trx",
      updatedAt: 1_000,
      inScope: 2,
      mapped: 1,
      unmapped: 1,
      entries: [{ outcomeKey: "k", reason: "not_in_trx" as const }],
    };
    assert.strictEqual(shouldRestoreSkipSnapshot(snap, "/a/trx.trx", 2_000, 5_000), true);
    assert.strictEqual(shouldRestoreSkipSnapshot(snap, "/b/other.trx", 2_000, 5_000), false);
    assert.strictEqual(shouldRestoreSkipSnapshot(snap, "/a/trx.trx", 10_000, 5_000), false);
    assert.strictEqual(shouldRestoreSkipSnapshot(undefined, "/a/trx.trx", 2_000, 5_000), false);
  });

  it("applySkipReasonSnapshot only for known discovery keys", () => {
    const store = new OutcomeStore();
    const key = scenarioKey(feature, feature.scenarios[1]);
    const applied = applySkipReasonSnapshot(store, domains, {
      updatedAt: 1,
      inScope: 2,
      mapped: 1,
      unmapped: 1,
      entries: [
        { outcomeKey: key, reason: "canceled" },
        { outcomeKey: "gone::key", reason: "not_in_trx" },
      ],
    });
    assert.strictEqual(applied, 1);
    assert.strictEqual(store.getSkipReason(key), "canceled");
  });

  it("mappingReportFromSkipSnapshot rebuilds resolvable leaves", () => {
    const key = scenarioKey(feature, feature.scenarios[1]);
    const report = mappingReportFromSkipSnapshot(
      {
        updatedAt: 1,
        inScope: 2,
        mapped: 1,
        unmapped: 1,
        entries: [{ outcomeKey: key, reason: "not_in_trx" }],
      },
      domains,
    );
    assert.strictEqual(report.unmapped, 1);
    assert.strictEqual(report.unmappedLeaves[0].scenarioName, "Two");
    assert.strictEqual(report.unmappedLeaves[0].featurePath, "/x/Sample.feature");
    assert.strictEqual(report.unusedTrx, undefined);
    assert.strictEqual(report.ambiguousLeaves, undefined);
    assert.strictEqual(report.sharedChosenCount, undefined);
  });

  it("parseSkipReasonSnapshot rejects garbage", () => {
    assert.strictEqual(parseSkipReasonSnapshot(null), undefined);
    assert.strictEqual(parseSkipReasonSnapshot({ entries: [], updatedAt: 1 }), undefined);
    const ok = parseSkipReasonSnapshot({
      updatedAt: 5,
      trxPath: "/t.trx",
      entries: [{ outcomeKey: "a", reason: "not_in_trx" }],
    });
    assert.ok(ok);
    assert.strictEqual(ok!.entries.length, 1);
  });
});
