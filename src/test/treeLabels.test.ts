import * as assert from "assert";
import { describe, it } from "node:test";
import { formatOutcomeForTooltip } from "../core/results/outcomeFeedback";
import {
  buildFeatureDescription,
  buildScenarioDescription,
  buildScenarioTooltipMarkdown,
  formatExampleIdentityLabel,
  formatOutlineIdentityLabel,
  formatScenarioIdentityLabel,
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

  it("buildScenarioDescription prioritizes duration label", () => {
    assert.strictEqual(buildScenarioDescription(tags, "count", 2, "2.3 s"), "2.3 s · 6 tags");
    assert.strictEqual(buildScenarioDescription([], "count", 2), "");
  });

  it("buildFeatureDescription includes scenario count", () => {
    assert.strictEqual(
      buildFeatureDescription(19, tags, "count", 2),
      "19 scenarios · 6 tags",
    );
  });

  it("prefixes Gherkin vocabulary on Pilot labels", () => {
    assert.strictEqual(formatScenarioIdentityLabel("Login works", "en"), "Scenario: Login works");
    assert.strictEqual(formatOutlineIdentityLabel("Checkout", "en"), "Outline: Checkout");
    assert.strictEqual(formatExampleIdentityLabel("plan | monthly", "en"), "Example: plan | monthly");
    assert.strictEqual(formatScenarioIdentityLabel("Login works", "es"), "Escenario: Login works");
    assert.strictEqual(formatOutlineIdentityLabel("Checkout", "es"), "Esquema: Checkout");
    assert.strictEqual(formatExampleIdentityLabel("plan | monthly", "es"), "Ejemplo: plan | monthly");
  });

  it("tooltip includes full tag lists and localized outcome", () => {
    const md = buildScenarioTooltipMarkdown(
      {
        scenarioName: "Retrieve all internal funds",
        featureName: "Funds Management",
        fileName: "Funds.feature",
        line: 12,
        featureTags: ["Funds", "P1"],
        scenarioTags: tags,
        isOutline: false,
        outcomeLabel: formatOutcomeForTooltip("failed", "en"),
        durationMs: 1200,
      },
      "en",
    );
    assert.match(md, /Retrieve all internal funds/);
    assert.match(md, /`@WM-5874`/);
    assert.match(md, /Last run: \*\*failed\*\*/);
  });
});
