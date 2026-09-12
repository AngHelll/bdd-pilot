import * as assert from "assert";
import { describe, it } from "node:test";
import { enrichFeaturesWithTheoryTests, inferExamplesFromTestNames } from "../core/gherkin/theoryExamples";
import { parseFeature } from "../core/gherkin/parser";
import { FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import {
  businessTheoryParams,
  extractListedTestNames,
  parseTheoryDisplayName,
  pickleIndexFromTestName,
} from "../core/runner/theoryDisplayName";

describe("theoryDisplayName", () => {
  it("parses Reqnroll/xUnit theory display names", () => {
    const parsed = parseTheoryDisplayName(
      'Add two numbers(first: "1", second: "2", result: "3", exampleTags: [])',
    );
    assert.ok(parsed);
    assert.strictEqual(parsed!.title, "Add two numbers");
    assert.deepStrictEqual(parsed!.params, [
      { name: "first", value: "1" },
      { name: "second", value: "2" },
      { name: "result", value: "3" },
    ]);
  });

  it("parses unquoted scalars and keeps __pickleIndex for tie-break", () => {
    const parsed = parseTheoryDisplayName(
      'Paint the tile(color: "red", __pickleIndex: 11, exampleTags: [])',
    );
    assert.ok(parsed);
    assert.deepStrictEqual(parsed!.params, [
      { name: "color", value: "red" },
      { name: "__pickleIndex", value: "11" },
    ]);
  });

  it("treats __* as metadata and pickleIndex without __ as business", () => {
    const parsed = parseTheoryDisplayName(
      'Paint the tile(color: "red", __pickleIndex: 2, pickleIndex: "9", exampleTags: [])',
    );
    assert.ok(parsed);
    assert.deepStrictEqual(businessTheoryParams(parsed!.params), [
      { name: "color", value: "red" },
      { name: "pickleIndex", value: "9" },
    ]);
    assert.strictEqual(
      pickleIndexFromTestName(
        'Ns.AlphaFeature.PaintTheTile(color: "red", __pickleIndex: 2, pickleIndex: "9", exampleTags: [])',
      ),
      2,
    );
  });

  it("extracts listed test names from dotnet output", () => {
    const names = extractListedTestNames([
      "Test run for /tmp/MinimalBdd.dll",
      "The following Tests are available:",
      "    Welcome user(name: \"Alice\", exampleTags: [])",
      "    System is ready",
    ].join("\n"));
    assert.deepStrictEqual(names, [
      "Welcome user(name: \"Alice\", exampleTags: [])",
      "System is ready",
    ]);
  });
});

describe("theoryExamples", () => {
  const scenario: ScenarioInfo = {
    name: "Welcome user",
    tags: [],
    line: 3,
    isOutline: true,
    stepParams: ["name"],
  };

  it("infers outline rows from theory test names", () => {
    const rows = inferExamplesFromTestNames(scenario, [
      'Welcome user(name: "Alice", exampleTags: [])',
      'Welcome user(name: "Bob", exampleTags: [])',
    ]);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].label, "name=Alice");
    assert.strictEqual(rows[1].label, "name=Bob");
  });

  it("does not infer runner metadata as Examples columns", () => {
    const rows = inferExamplesFromTestNames(scenario, [
      'Welcome user(name: "Alice", __pickleIndex: 0, exampleTags: [])',
    ]);
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0].headers, ["name"]);
    assert.deepStrictEqual(rows[0].values, ["Alice"]);
  });

  it("enriches features missing Examples tables", () => {
    const features: FeatureInfo[] = [
      {
        name: "Greetings",
        filePath: "/x/Greetings.feature",
        tags: [],
        scenarios: [{ ...scenario, examples: undefined }],
      },
    ];
    const count = enrichFeaturesWithTheoryTests(features, [
      'Welcome user(name: "Alice", exampleTags: [])',
    ]);
    assert.strictEqual(count, 1);
    assert.strictEqual(features[0].scenarios[0].examples?.length, 1);
  });
});

describe("parser Scenarios keyword", () => {
  it("parses Scenarios tables and step params", () => {
    const content = [
      "Feature: Greetings",
      "  Scenario Outline: Welcome user",
      "    Given the greeting target is <name>",
      "    Scenarios:",
      "      | name |",
      "      | Alice |",
    ].join("\n");
    const feature = parseFeature("/x/Greetings.feature", content);
    const outline = feature.scenarios[0];
    assert.strictEqual(outline.isOutline, true);
    assert.deepStrictEqual(outline.stepParams, ["name"]);
    assert.strictEqual(outline.examples?.length, 1);
    assert.strictEqual(outline.examples?.[0].label, "name=Alice");
  });
});
