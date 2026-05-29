import * as assert from "assert";
import { describe, it } from "node:test";
import { parseFeature, extractTags } from "../core/gherkin/parser";

describe("gherkin parser", () => {
  it("parses feature name, feature tags and scenarios", () => {
    const content = [
      "@Login @Authentication @P0 @critical",
      "Feature: Login",
      "  As a client I want to authenticate",
      "",
      "  @P0 @Level3 @functional @WM-6047",
      "  Scenario: Successfully authenticate and receive valid token",
      "    Given Generate EP token",
      "    Then I should receive a valid access token",
      "",
      "  @P1 @Level2",
      "  Scenario Outline: Reject invalid credentials",
      "    When I login with <user>",
      "    Examples:",
      "      | user |",
      "      | bad  |",
    ].join("\n");

    const feature = parseFeature("/x/Features/Security/Login.feature", content);

    assert.strictEqual(feature.name, "Login");
    assert.deepStrictEqual(feature.tags, ["Login", "Authentication", "P0", "critical"]);
    assert.strictEqual(feature.scenarios.length, 2);

    assert.strictEqual(feature.scenarios[0].name, "Successfully authenticate and receive valid token");
    assert.deepStrictEqual(feature.scenarios[0].tags, ["P0", "Level3", "functional", "WM-6047"]);
    assert.strictEqual(feature.scenarios[0].isOutline, false);

    assert.strictEqual(feature.scenarios[1].isOutline, true);
    assert.deepStrictEqual(feature.scenarios[1].tags, ["P1", "Level2"]);
  });

  it("ignores comments and does not leak tags across blocks", () => {
    const content = [
      "# a comment",
      "@FeatureTag",
      "Feature: Sample",
      "  Background:",
      "    Given a precondition",
      "  Scenario: First",
      "    Then ok",
    ].join("\n");
    const feature = parseFeature("/x/Sample.feature", content);
    assert.deepStrictEqual(feature.tags, ["FeatureTag"]);
    assert.strictEqual(feature.scenarios.length, 1);
    assert.deepStrictEqual(feature.scenarios[0].tags, []);
  });

  it("falls back to file base name when Feature line is missing", () => {
    const feature = parseFeature("/x/NoHeader.feature", "Scenario: only\n  Then ok");
    assert.strictEqual(feature.name, "NoHeader");
  });

  it("extractTags strips '@' and whitespace", () => {
    assert.deepStrictEqual(extractTags("  @a   @b-c @d_e "), ["a", "b-c", "d_e"]);
  });
});
