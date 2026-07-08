import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeStore } from "../providers/outcomeStore";
import {
  applyScopedTrxResults,
  computeTreeMappingStats,
} from "../core/results/trxTreeMapping";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";
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
          {
            name: "Many",
            tags: [],
            line: 8,
            isOutline: true,
            examples: [
              { rowIndex: 0, line: 10, headers: ["x"], values: ["a"], label: "x=a" },
              { rowIndex: 1, line: 11, headers: ["x"], values: ["b"], label: "x=b" },
            ],
          },
        ],
      },
    ],
  },
];

const feature = domains[0].features[0];

describe("trxTreeMapping", () => {
  it("marks scoped leaves not_in_trx and returns mapping stats", () => {
    const store = new OutcomeStore();
    const scenario = feature.scenarios[0];
    const summary: UnifiedSummary = {
      source: "trx",
      passed: 1,
      failed: 0,
      skipped: 0,
      total: 1,
      results: [
        {
          testName: "SampleFeature.One",
          outcome: "passed",
          durationMs: 10,
        },
      ],
    };

    const stats = applyScopedTrxResults(
      store,
      domains,
      summary,
      [{ kind: "feature", feature }],
    );

    assert.ok(stats);
    assert.strictEqual(stats!.inScope, 4);
    assert.strictEqual(stats!.mapped, 1);
    assert.strictEqual(stats!.unmapped, 3);
    assert.strictEqual(store.get(scenarioKey(feature, scenario)), "passed");
    assert.strictEqual(store.getSkipReason(scenarioKey(feature, feature.scenarios[1])), "not_in_trx");
    assert.strictEqual(
      store.getSkipReason(outlineRowKey(feature, feature.scenarios[2], 1)),
      "not_in_trx",
    );
  });

  it("computeTreeMappingStats counts mapped outcomes in scope", () => {
    const store = new OutcomeStore();
    const keys = new Set([
      scenarioKey(feature, feature.scenarios[0]),
      scenarioKey(feature, feature.scenarios[1]),
    ]);
    store.set(scenarioKey(feature, feature.scenarios[0]), "passed");
    const stats = computeTreeMappingStats(keys, store);
    assert.strictEqual(stats.inScope, 2);
    assert.strictEqual(stats.mapped, 1);
    assert.strictEqual(stats.unmapped, 1);
  });

  it("run-all does not mark not_in_trx", () => {
    const store = new OutcomeStore();
    const summary: UnifiedSummary = {
      source: "trx",
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      results: [],
    };
    const stats = applyScopedTrxResults(store, domains, summary, [{ kind: "all" }]);
    assert.strictEqual(stats, undefined);
    assert.strictEqual(store.getSkipReason(scenarioKey(feature, feature.scenarios[0])), undefined);
  });
});
