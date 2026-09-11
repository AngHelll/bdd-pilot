import * as assert from "assert";
import { describe, it } from "node:test";
import {
  countFailedLeavesByDomain,
  countFailedLeavesByTag,
  countLeavesInDomain,
  detectFailConcentration,
  FAIL_MIN_COUNT,
  FAIL_SHARE_PCT,
  MIN_CONTAINERS_FOR_NUDGE,
  MIN_LEAVES_FOR_NUDGE,
  shouldSuggestScopedRunBeforeAll,
} from "../core/runner/scopedRunNudge";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { TagGroup } from "../core/gherkin/groupByTag";
import { TestOutcome } from "../core/results/trxParser";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";

function feature(name: string, filePath: string, scenarios: ScenarioInfo[]): FeatureInfo {
  return { name, filePath, tags: [], scenarios };
}

function scenario(name: string, line: number, examples?: ScenarioInfo["examples"]): ScenarioInfo {
  return {
    name,
    line,
    tags: [],
    isOutline: !!(examples && examples.length > 0),
    examples,
  };
}

describe("scopedRunNudge", () => {
  describe("shouldSuggestScopedRunBeforeAll", () => {
    it("returns false for small / few-container suites (minimal-bdd shape)", () => {
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: 1,
          estimatedLeafCount: 10,
          suggestEnabled: true,
          sessionSuppressed: false,
        }),
        false,
      );
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: MIN_CONTAINERS_FOR_NUDGE - 1,
          estimatedLeafCount: MIN_LEAVES_FOR_NUDGE + 10,
          suggestEnabled: true,
          sessionSuppressed: false,
        }),
        false,
      );
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: MIN_CONTAINERS_FOR_NUDGE,
          estimatedLeafCount: MIN_LEAVES_FOR_NUDGE - 1,
          suggestEnabled: true,
          sessionSuppressed: false,
        }),
        false,
      );
    });

    it("returns true for large multi-container suites", () => {
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: 5,
          estimatedLeafCount: 100,
          suggestEnabled: true,
          sessionSuppressed: false,
        }),
        true,
      );
    });

    it("respects setting off and session suppress", () => {
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: 5,
          estimatedLeafCount: 100,
          suggestEnabled: false,
          sessionSuppressed: false,
        }),
        false,
      );
      assert.strictEqual(
        shouldSuggestScopedRunBeforeAll({
          containerCount: 5,
          estimatedLeafCount: 100,
          suggestEnabled: true,
          sessionSuppressed: true,
        }),
        false,
      );
    });
  });

  describe("detectFailConcentration", () => {
    it("returns undefined when fails are sparse or evenly split", () => {
      assert.strictEqual(
        detectFailConcentration({ Alpha: 2, Beta: 2 }),
        undefined,
        "below FAIL_MIN_COUNT",
      );
      assert.strictEqual(
        detectFailConcentration({ Alpha: 5, Beta: 5 }),
        undefined,
        "50/50 below share",
      );
      assert.ok(FAIL_SHARE_PCT >= 0.6);
      assert.ok(FAIL_MIN_COUNT >= 5);
    });

    it("returns top synthetic container when share is high", () => {
      const hit = detectFailConcentration({ Alpha: 9, Beta: 1, Gamma: 0 });
      assert.ok(hit);
      assert.strictEqual(hit!.container, "Alpha");
      assert.strictEqual(hit!.failCount, 9);
      assert.strictEqual(hit!.totalFails, 10);
      assert.ok(hit!.share >= FAIL_SHARE_PCT);
    });
  });

  describe("countFailedLeavesByDomain / Tag", () => {
    const alphaFeature = feature("A", "/repo/Features/Alpha/A.feature", [
      scenario("one", 10),
      scenario("two", 20, [
        { rowIndex: 0, headers: ["x"], values: ["1"], line: 30, label: "x=1" },
        { rowIndex: 1, headers: ["x"], values: ["2"], line: 31, label: "x=2" },
      ]),
    ]);
    const betaFeature = feature("B", "/repo/Features/Beta/B.feature", [scenario("solo", 5)]);
    const domains: DomainGroup[] = [
      { name: "Alpha", features: [alphaFeature] },
      { name: "Beta", features: [betaFeature] },
      { name: "Gamma", features: [] },
    ];

    it("counts domain fails including outline rows", () => {
      const outcomes = new Map<string, TestOutcome>([
        [scenarioKey(alphaFeature, alphaFeature.scenarios[0]!), "failed"],
        [outlineRowKey(alphaFeature, alphaFeature.scenarios[1]!, 0), "failed"],
        [outlineRowKey(alphaFeature, alphaFeature.scenarios[1]!, 1), "passed"],
        [scenarioKey(betaFeature, betaFeature.scenarios[0]!), "failed"],
      ]);
      const map = countFailedLeavesByDomain(domains, (k) => outcomes.get(k));
      assert.strictEqual(map.get("Alpha"), 2);
      assert.strictEqual(map.get("Beta"), 1);
      assert.strictEqual(map.has("Gamma"), false);
      assert.strictEqual(countLeavesInDomain(domains[0]!), 3);
    });

    it("counts tag fails with synthetic tags", () => {
      const tagGroups: TagGroup[] = [
        {
          tag: "smoke",
          scenarios: [
            { feature: alphaFeature, scenario: alphaFeature.scenarios[0]! },
            { feature: betaFeature, scenario: betaFeature.scenarios[0]! },
          ],
        },
        {
          tag: "deep",
          scenarios: [{ feature: alphaFeature, scenario: alphaFeature.scenarios[1]! }],
        },
      ];
      const outcomes = new Map<string, TestOutcome>([
        [scenarioKey(alphaFeature, alphaFeature.scenarios[0]!), "failed"],
        [outlineRowKey(alphaFeature, alphaFeature.scenarios[1]!, 0), "failed"],
        [outlineRowKey(alphaFeature, alphaFeature.scenarios[1]!, 1), "failed"],
        [scenarioKey(betaFeature, betaFeature.scenarios[0]!), "passed"],
      ]);
      const map = countFailedLeavesByTag(tagGroups, (k) => outcomes.get(k));
      assert.strictEqual(map.get("smoke"), 1);
      assert.strictEqual(map.get("deep"), 2);
    });
  });
});
