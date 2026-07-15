import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeStore } from "../providers/outcomeStore";
import {
  applyScopedTrxResults,
  computeTreeMappingStats,
  listUnmappedScopedLeaves,
} from "../core/results/trxTreeMapping";
import { selectUnmappedForOutput } from "../core/results/mappingReportFormat";
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
    assert.strictEqual(stats!.unmappedLeaves.length, 3);
    assert.deepStrictEqual(
      stats!.unmappedLeaves.map((l) => l.label),
      ["Sample · Two", "Sample · Many · x=a", "Sample · Many · x=b"],
    );
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

  it("listUnmappedScopedLeaves returns only unmapped keys in scope", () => {
    const store = new OutcomeStore();
    const keys = new Set([
      scenarioKey(feature, feature.scenarios[0]),
      scenarioKey(feature, feature.scenarios[1]),
    ]);
    store.set(scenarioKey(feature, feature.scenarios[0]), "passed");
    const leaves = listUnmappedScopedLeaves(keys, store, domains);
    assert.strictEqual(leaves.length, 1);
    assert.strictEqual(leaves[0].scenarioName, "Two");
    assert.strictEqual(leaves[0].line, 5);
  });

  it("selectUnmappedForOutput caps list and reports remaining", () => {
    const fake = Array.from({ length: 30 }, (_, i) => ({
      outcomeKey: `k${i}`,
      featureName: "F",
      featurePath: "/f.feature",
      scenarioName: `S${i}`,
      line: i + 1,
      label: `F · S${i}`,
    }));
    const { shown, remaining } = selectUnmappedForOutput(fake, 25);
    assert.strictEqual(shown.length, 25);
    assert.strictEqual(remaining, 5);
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

  it("maps TRX to the feature class when scenario titles collide", () => {
    const twinDomains: DomainGroup[] = [
      {
        name: "General",
        features: [
          {
            name: "Alpha",
            filePath: "/x/Alpha.feature",
            tags: [],
            scenarios: [{ name: "Shared", tags: [], line: 2, isOutline: false }],
          },
          {
            name: "Beta",
            filePath: "/x/Beta.feature",
            tags: [],
            scenarios: [{ name: "Shared", tags: [], line: 2, isOutline: false }],
          },
        ],
      },
    ];
    const store = new OutcomeStore();
    const summary: UnifiedSummary = {
      source: "trx",
      passed: 1,
      failed: 0,
      skipped: 0,
      total: 1,
      results: [{ testName: "BetaFeature.Shared", outcome: "passed", durationMs: 5 }],
    };
    applyScopedTrxResults(store, twinDomains, summary, [{ kind: "all" }]);
    const alpha = twinDomains[0].features[0];
    const beta = twinDomains[0].features[1];
    assert.strictEqual(store.get(scenarioKey(alpha, alpha.scenarios[0])), undefined);
    assert.strictEqual(store.get(scenarioKey(beta, beta.scenarios[0])), "passed");
  });
});
