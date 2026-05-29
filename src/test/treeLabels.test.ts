import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildFeatureDescription,
  buildScenarioDescription,
  buildScenarioTooltipMarkdown,
  formatTagDescription,
} from "../core/gherkin/treeLabels";

describe("treeLabels", () => {
  const tags = ["P1", "Level3", "functional", "WM-5874", "smoke", "regression"];

  it("count mode summarizes many tags", () => {
    assert.strictEqual(formatTagDescription(tags, "count"), "6 tags");
    assert.strictEqual(formatTagDescription(["smoke"], "count"), "@smoke");
  });

  it("compact mode truncates with +N", () => {
    assert.strictEqual(formatTagDescription(tags, "compact", 2), "@P1 @Level3 +4");
  });

  it("hidden mode returns empty", () => {
    assert.strictEqual(formatTagDescription(tags, "hidden"), "");
  });

  it("buildScenarioDescription prioritizes duration", () => {
    assert.strictEqual(
      buildScenarioDescription(tags, "count", 2, 450),
      "450 ms · 6 tags",
    );
    assert.strictEqual(buildScenarioDescription([], "count", 2), "");
  });

  it("buildFeatureDescription includes scenario count", () => {
    assert.strictEqual(
      buildFeatureDescription(19, tags, "count", 2),
      "19 scenarios · 6 tags",
    );
  });

  it("tooltip includes full tag lists", () => {
    const md = buildScenarioTooltipMarkdown({
      scenarioName: "Retrieve all internal funds",
      featureName: "Funds Management",
      fileName: "Funds.feature",
      line: 12,
      featureTags: ["Funds", "P1"],
      scenarioTags: tags,
      isOutline: false,
      outcome: "failed",
      durationMs: 1200,
    });
    assert.match(md, /Retrieve all internal funds/);
    assert.match(md, /`@WM-5874`/);
    assert.match(md, /Last run: \*\*failed\*\*/);
  });
});
