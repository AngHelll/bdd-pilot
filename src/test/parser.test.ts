import * as assert from "assert";
import { describe, it } from "node:test";
import { buildExampleLabel, extractTags, parseFeature, parseTableRow } from "../core/gherkin/parser";
import { effectiveScenarioTags } from "../core/gherkin/tags";

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
    assert.strictEqual(feature.scenarios[1].examples?.length, 1);
    assert.strictEqual(feature.scenarios[1].examples?.[0].label, "user=bad");
    assert.strictEqual(feature.scenarios[1].examples?.[0].line, 15);
  });

  it("parses multi-column Examples rows", () => {
    const content = [
      "Feature: Trading Buying Power",
      "  Scenario Outline: Reject invalid GUID values in path parameters",
      "    When I use <parameter> with <value>",
      "    Examples:",
      "      | parameter   | value        | expected_message |",
      "      | contract_id | invalid-guid | Guid contractId  |",
      "      | account_id  | 3            | Guid accountId   |",
    ].join("\n");

    const feature = parseFeature("/x/BuyingPower.feature", content);
    const outline = feature.scenarios[0];
    assert.strictEqual(outline.examples?.length, 2);
    assert.strictEqual(outline.examples?.[0].label, "parameter=contract_id, value=invalid-guid +1");
    assert.strictEqual(outline.examples?.[0].line, 6);
    assert.deepStrictEqual(outline.examples?.[1].values, ["account_id", "3", "Guid accountId"]);
    assert.strictEqual(outline.examples?.[1].line, 7);
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

  it("effectiveScenarioTags merges feature and scenario tags", () => {
    const feature = parseFeature("/x/F.feature", "@Smoke @P1\nFeature: F\n@P1\nScenario: S\n  Then ok");
    const scenario = feature.scenarios[0];
    assert.deepStrictEqual(effectiveScenarioTags(feature, scenario), ["Smoke", "P1"]);
  });
});

describe("parseTableRow", () => {
  it("splits pipe-delimited rows", () => {
    assert.deepStrictEqual(parseTableRow("| a | b |"), ["a", "b"]);
  });
});

describe("buildExampleLabel", () => {
  it("formats one and two column labels", () => {
    assert.strictEqual(buildExampleLabel(["user"], ["bad"]), "user=bad");
    assert.strictEqual(
      buildExampleLabel(["a", "b"], ["1", "2"]),
      "a=1, b=2",
    );
  });
});
