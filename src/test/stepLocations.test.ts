import * as assert from "assert";
import { describe, it } from "node:test";
import { parseFeatureStepLocations } from "../core/gherkin/stepLocations";

const SAMPLE = `@smoke
Feature: Gate Sample

  Background:
    Given background step one

  Scenario: First
    When first step
    Then assert first

  Scenario Outline: Outline
    When outline <value>
    Then check <value>

    Examples:
      | value |
      | one   |
`;

describe("stepLocations", () => {
  it("uses 0-based line numbers for steps", () => {
    const lines = SAMPLE.split(/\r?\n/);
    const locations = parseFeatureStepLocations("/x/Gate.feature", SAMPLE);
    assert.ok(locations.length >= 4);

    const background = locations.find((l) => l.scenarioName === "Background");
    assert.ok(background);
    assert.strictEqual(background!.line0, lines.findIndex((l) => l.includes("background step one")));

    const firstWhen = locations.find((l) => l.stepText.includes("first step"));
    assert.ok(firstWhen);
    assert.strictEqual(firstWhen!.scenarioName, "First");
  });

  it("includes Background steps separately from scenarios", () => {
    const locations = parseFeatureStepLocations("/x/Gate.feature", SAMPLE);
    assert.ok(locations.some((l) => l.scenarioName === "Background"));
    assert.ok(locations.some((l) => l.scenarioName === "First"));
  });
});
