import * as assert from "assert";
import { describe, it } from "node:test";
import { FeatureInfo } from "../core/gherkin/model";
import {
  collectOutcomeKeysForTargets,
  outlineRowKey,
  scenarioKey,
} from "../core/runner/runScope";

const feature: FeatureInfo = {
  name: "Buying Power",
  filePath: "/proj/Features/Trading/BuyingPower/BuyingPower.feature",
  tags: [],
  scenarios: [
    {
      name: "Scenario A",
      tags: [],
      line: 10,
      isOutline: false,
    },
    {
      name: "Outline B",
      tags: [],
      line: 20,
      isOutline: true,
      examples: [
        { rowIndex: 0, line: 25, headers: ["x"], values: ["1"], label: "x=1" },
        { rowIndex: 1, line: 26, headers: ["x"], values: ["2"], label: "x=2" },
      ],
    },
  ],
};

const domains = [{ name: "Trading", features: [feature] }];

describe("runScope", () => {
  it("returns all for run-all target", () => {
    assert.strictEqual(collectOutcomeKeysForTargets([{ kind: "all" }], domains), "all");
  });

  it("returns empty set for unknown raw-filter scope", () => {
    const keys = collectOutcomeKeysForTargets([], domains);
    assert.ok(keys instanceof Set);
    assert.strictEqual(keys.size, 0);
  });

  it("collects keys for a single scenario", () => {
    const scenario = feature.scenarios[0];
    const keys = collectOutcomeKeysForTargets(
      [{ kind: "scenario", feature, scenario }],
      domains,
    );
    assert.strictEqual(keys instanceof Set ? keys.size : 0, 1);
    if (keys instanceof Set) {
      assert.ok(keys.has(scenarioKey(feature, scenario)));
    }
  });

  it("collects keys for one outline row only", () => {
    const scenario = feature.scenarios[1];
    const example = scenario.examples![0];
    const keys = collectOutcomeKeysForTargets(
      [{ kind: "outlineRow", feature, scenario, example }],
      domains,
    );
    assert.strictEqual(keys instanceof Set ? keys.size : 0, 1);
    if (keys instanceof Set) {
      assert.ok(keys.has(outlineRowKey(feature, scenario, 0)));
      assert.ok(!keys.has(outlineRowKey(feature, scenario, 1)));
    }
  });

  it("collects all outline row keys when running whole outline scenario", () => {
    const scenario = feature.scenarios[1];
    const keys = collectOutcomeKeysForTargets(
      [{ kind: "scenario", feature, scenario }],
      domains,
    );
    assert.strictEqual(keys instanceof Set ? keys.size : 0, 2);
  });
});
