import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describe, it } from "node:test";
import { parseFeature } from "../core/gherkin/parser";
import { visibleExampleItemId } from "../core/gherkin/treeIdentity";
import {
  buildScenarioTooltipMarkdown,
  treeLeafNavigationLine,
} from "../core/gherkin/treeLabels";

const smokePath = path.resolve(
  __dirname,
  "..",
  "..",
  "samples",
  "minimal-bdd",
  "Features",
  "Smoke.feature",
);

describe("tree leaf navigation", () => {
  const feature = parseFeature(smokePath, fs.readFileSync(smokePath, "utf8"));
  const ready = feature.scenarios.find((scenario) => scenario.name === "System is ready");
  const outline = feature.scenarios.find((scenario) => scenario.name === "Add two numbers");
  const secondRow = outline?.examples?.find(
    (example) => example.values.join(",") === "5,7,12",
  );

  it("opens an Examples row on its data line and shows that line in the tooltip", () => {
    assert.ok(outline);
    assert.ok(secondRow);
    assert.strictEqual(outline!.line, 10);
    assert.deepStrictEqual(
      outline!.examples?.map((example) => example.line),
      [18, 19],
    );

    const line = treeLeafNavigationLine(outline!.line, secondRow!.line);
    assert.strictEqual(line, 19);
    assert.strictEqual(line - 1, 18);

    const tooltip = buildScenarioTooltipMarkdown(
      {
        scenarioName: outline!.name,
        featureName: feature.name,
        fileName: "Smoke.feature",
        line,
        featureTags: feature.tags,
        scenarioTags: outline!.tags,
        isOutline: true,
        exampleRowLabel: secondRow!.label,
      },
      "en",
    );
    assert.match(tooltip, /line 19/);
    assert.match(tooltip, /Example row: `first=5, second=7 \+1`/);
    assert.doesNotMatch(tooltip, /line 10/);
  });

  it("keeps scenario and outline header navigation on the header line", () => {
    assert.ok(ready);
    assert.ok(outline);
    assert.strictEqual(treeLeafNavigationLine(ready!.line), ready!.line);
    assert.strictEqual(treeLeafNavigationLine(outline!.line), 10);
    assert.strictEqual(treeLeafNavigationLine(outline!.line) - 1, 9);
  });

  it("keeps the example node id on the outline line and row index", () => {
    assert.ok(outline);
    assert.ok(secondRow);
    const id = visibleExampleItemId(
      feature.filePath,
      outline!.line,
      secondRow!.rowIndex,
      undefined,
      "domain",
      [],
    );
    const idIfRowLineWereUsed = visibleExampleItemId(
      feature.filePath,
      secondRow!.line,
      secondRow!.rowIndex,
      undefined,
      "domain",
      [],
    );
    assert.strictEqual(id, `example|${encodeURIComponent(feature.filePath)}|10|1`);
    assert.notStrictEqual(id, idIfRowLineWereUsed);
  });
});
