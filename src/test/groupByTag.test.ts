import * as assert from "assert";
import { describe, it } from "node:test";
import { groupByTag, tagsMatch } from "../core/gherkin/groupByTag";
import { DomainGroup, FeatureInfo } from "../core/gherkin/model";
import { parseFeature } from "../core/gherkin/parser";

function feature(name: string, tags: string[], scenarios: FeatureInfo["scenarios"]): FeatureInfo {
  return {
    name,
    filePath: `/x/Features/${name}.feature`,
    tags,
    scenarios,
  };
}

describe("groupByTag", () => {
  const domains: DomainGroup[] = [
    {
      name: "General",
      features: [
        feature("Smoke", ["bdd-pilot-smoke"], [
          { name: "System is ready", tags: ["smoke"], line: 5, isOutline: false },
          {
            name: "Add two numbers",
            tags: [],
            line: 10,
            isOutline: true,
            examples: [
              { rowIndex: 0, line: 14, headers: ["a"], values: ["1"], label: "a=1" },
            ],
          },
        ]),
        feature("Login", ["smoke"], [
          { name: "Valid user", tags: [], line: 3, isOutline: false },
        ]),
      ],
    },
  ];

  it("groups scenarios by effective tags", () => {
    const groups = groupByTag(domains);
    assert.strictEqual(groups.length, 2);

    const smoke = groups.find((g) => g.tag === "smoke")!;
    assert.ok(smoke);
    assert.strictEqual(smoke.scenarios.length, 2);
    assert.ok(smoke.scenarios.some((s) => s.feature.name === "Smoke" && s.scenario.name === "System is ready"));
    assert.ok(smoke.scenarios.some((s) => s.feature.name === "Login" && s.scenario.name === "Valid user"));

    const pilot = groups.find((g) => g.tag === "bdd-pilot-smoke")!;
    assert.strictEqual(pilot.scenarios.length, 2);
  });

  it("deduplicates scenario under the same tag", () => {
    const groups = groupByTag(domains);
    const smoke = groups.find((g) => g.tag === "smoke")!;
    const keys = smoke.scenarios.map((s) => `${s.feature.filePath}:${s.scenario.line}`);
    assert.strictEqual(new Set(keys).size, keys.length);
  });

  it("does not place the scenario after a tagged Examples block under that tag", () => {
    const parsed = parseFeature(
      "/x/ExampleTags.feature",
      [
        "Feature: Example tags",
        "  Scenario Outline: Tagged rows",
        "    Given value <value>",
        "    @smoke",
        "    Examples:",
        "      | value |",
        "      | a     |",
        "  Scenario: Unrelated",
        "    Given something else",
      ].join("\n"),
    );
    const names = groupByTag([{ name: "General", features: [parsed] }])
      .filter((group) => group.tag.toLowerCase() === "smoke")
      .flatMap((group) => group.scenarios.map((ref) => ref.scenario.name));

    assert.deepStrictEqual(names, []);
  });

  it("tagsMatch is case-insensitive", () => {
    assert.ok(tagsMatch("Smoke", "smoke"));
    assert.ok(!tagsMatch("smoke", "regression"));
  });
});
