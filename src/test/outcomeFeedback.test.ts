import * as assert from "assert";
import { describe, it } from "node:test";
import { buildScenarioTooltipMarkdown } from "../core/gherkin/treeLabels";
import {
  formatOutcomeForTooltip,
  prependFailedOutcomeToDescription,
  sanitizeErrorForStore,
  truncateErrorSnippet,
} from "../core/results/outcomeFeedback";
import { skipReasonLabelForTreeOutcome } from "../core/results/skipReason";

describe("outcomeFeedback", () => {
  it("truncateErrorSnippet collapses whitespace and caps length", () => {
    const long = "line1\n\nline2 " + "x".repeat(200);
    const out = truncateErrorSnippet(long, 50);
    assert.ok(out.length <= 50);
    assert.ok(!out.includes("\n"));
  });

  it("sanitizeErrorForStore redacts secrets", () => {
    const out = sanitizeErrorForStore("password=secret-token");
    assert.ok(out);
    assert.match(out!, /password=\*\*\*REDACTED\*\*\*/);
    assert.ok(!out!.includes("secret-token"));
  });

  it("prependFailedOutcomeToDescription adds localized failed prefix", () => {
    const out = prependFailedOutcomeToDescription("en", "failed", "Expected true", "2.3 s");
    assert.match(out, /^failed · Expected true/);
    assert.match(out, /2\.3 s/);
  });

  it("buildScenarioTooltipMarkdown includes localized outcome and error line", () => {
    const md = buildScenarioTooltipMarkdown(
      {
        scenarioName: "Login",
        featureName: "Auth",
        fileName: "Login.feature",
        line: 10,
        featureTags: [],
        scenarioTags: ["smoke"],
        isOutline: false,
        outcomeLabel: formatOutcomeForTooltip("failed", "es"),
        errorSnippet: "Expected true but was false",
      },
      "es",
    );
    assert.match(md, /Last run: \*\*fallido\*\*/);
    assert.match(md, /Error: Expected true but was false/);
  });

  it("buildScenarioTooltipMarkdown includes skip reason for skipped outcomes", () => {
    const skipLabel = skipReasonLabelForTreeOutcome("skipped", "en");
    const md = buildScenarioTooltipMarkdown(
      {
        scenarioName: "Skipped scenario",
        featureName: "Feat",
        fileName: "F.feature",
        line: 3,
        featureTags: [],
        scenarioTags: [],
        isOutline: false,
        outcomeLabel: formatOutcomeForTooltip("skipped", "en"),
        skipReasonLabel: skipLabel,
      },
      "en",
    );
    assert.match(md, /Last run: \*\*skipped\*\*/);
    assert.match(md, /Skip: skipped by runner/);
  });
});
