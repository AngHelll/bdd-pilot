import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup, FeatureInfo } from "../core/gherkin/model";
import {
  collectFilteredRunTargets,
  filterDomainsBySearch,
  matchesSearch,
  shouldConfirmSearchRunCap,
} from "../core/gherkin/treeSearch";

const feature: FeatureInfo = {
  name: "Smoke login",
  filePath: "/repo/Features/Smoke/login.feature",
  tags: ["Regression"],
  scenarios: [
    {
      name: "User signs in",
      tags: ["smoke"],
      line: 5,
      isOutline: false,
    },
    {
      name: "Outline case",
      tags: [],
      line: 10,
      isOutline: true,
      examples: [
        { rowIndex: 0, line: 12, headers: ["id"], values: ["a"], label: "row A" },
        { rowIndex: 1, line: 13, headers: ["id"], values: ["b"], label: "row B" },
      ],
    },
  ],
};

const domains: DomainGroup[] = [{ name: "Auth", features: [feature] }];

describe("treeSearch", () => {
  it("@tag syntax matches tag only, not scenario name smoke", () => {
    const scenario = feature.scenarios[0];
    assert.ok(matchesSearch("@smoke", feature, scenario));
    assert.ok(!matchesSearch("@smoke", feature, { ...scenario, name: "smoke test", tags: [] }));
  });

  it("substring search matches scenario name without tag", () => {
    assert.ok(matchesSearch("signs", feature, feature.scenarios[0]));
  });

  it("filterDomainsBySearch keeps outline rows under matched scenarios", () => {
    const filtered = filterDomainsBySearch(domains, "outline");
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].features[0].scenarios.length, 1);
    const targets = collectFilteredRunTargets(filtered);
    assert.strictEqual(targets.length, 2);
    assert.ok(targets.every((t) => t.kind === "outlineRow"));
  });

  it("collectFilteredRunTargets returns empty when domains empty", () => {
    assert.deepStrictEqual(collectFilteredRunTargets([]), []);
  });

  it("collectFilteredRunTargets returns scenario target for simple scenario", () => {
    const filtered = filterDomainsBySearch(domains, "@smoke");
    const targets = collectFilteredRunTargets(filtered);
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0].kind, "scenario");
  });

  it("shouldConfirmSearchRunCap when over cap", () => {
    assert.strictEqual(shouldConfirmSearchRunCap(81, 80), true);
    assert.strictEqual(shouldConfirmSearchRunCap(80, 80), false);
    assert.strictEqual(shouldConfirmSearchRunCap(100, 0), false);
  });
});
