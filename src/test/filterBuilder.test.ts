import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildCombinedFilter,
  buildFilter,
  featureClassName,
  sanitizeIdentifier,
} from "../core/runner/filterBuilder";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";

const feature: FeatureInfo = {
  name: "Buying Power",
  filePath: "/x/Features/Trading/BuyingPower/BuyingPower.feature",
  tags: ["Trading"],
  scenarios: [],
};

const scenario: ScenarioInfo = {
  name: "Retrieve buying power for valid account",
  tags: ["P0"],
  line: 10,
  isOutline: false,
};

describe("filterBuilder", () => {
  it("returns undefined for 'all'", () => {
    assert.strictEqual(buildFilter({ kind: "all" }), undefined);
  });

  it("builds Category filter for tags", () => {
    assert.strictEqual(buildFilter({ kind: "tag", tag: "P0" }), "Category=P0");
  });

  it("builds FullyQualifiedName filter for features (with Feature class suffix)", () => {
    assert.strictEqual(
      buildFilter({ kind: "feature", feature }),
      "FullyQualifiedName~BuyingPowerFeature",
    );
  });

  it("builds FullyQualifiedName filter for scenarios (class.method)", () => {
    assert.strictEqual(
      buildFilter({ kind: "scenario", feature, scenario }),
      "FullyQualifiedName~BuyingPowerFeature.RetrieveBuyingPowerForValidAccount",
    );
  });

  it("featureClassName appends Feature suffix once", () => {
    assert.strictEqual(featureClassName("Stocks"), "StocksFeature");
    assert.strictEqual(featureClassName("Login"), "LoginFeature");
    assert.strictEqual(featureClassName("Buying Power"), "BuyingPowerFeature");
    // Already ends with Feature -> not doubled.
    assert.strictEqual(featureClassName("Login Feature"), "LoginFeature");
  });

  it("buildCombinedFilter ORs unique clauses and treats empty/all as run-all", () => {
    assert.strictEqual(buildCombinedFilter([]), undefined);
    assert.strictEqual(buildCombinedFilter([{ kind: "all" }, { kind: "tag", tag: "P0" }]), undefined);

    const scenario2: ScenarioInfo = { name: "Another scenario", tags: [], line: 20, isOutline: false };
    const combined = buildCombinedFilter([
      { kind: "scenario", feature, scenario },
      { kind: "scenario", feature, scenario: scenario2 },
      { kind: "scenario", feature, scenario },
    ]);
    assert.strictEqual(
      combined,
      "FullyQualifiedName~BuyingPowerFeature.RetrieveBuyingPowerForValidAccount|FullyQualifiedName~BuyingPowerFeature.AnotherScenario",
    );
  });

  it("sanitizeIdentifier pascal-cases and strips symbols", () => {
    assert.strictEqual(sanitizeIdentifier("Update WM account!"), "UpdateWMAccount");
    assert.strictEqual(sanitizeIdentifier("PPR Questionnaire"), "PPRQuestionnaire");
  });

  it("builds DisplayName filter for outline rows", () => {
    const outline: ScenarioInfo = {
      name: "Reject invalid GUID values in path parameters",
      tags: [],
      line: 28,
      isOutline: true,
      examples: [],
    };
    const example: OutlineExample = {
      rowIndex: 0,
      line: 38,
      headers: ["parameter", "value"],
      values: ["contract_id", "invalid-guid"],
      label: "parameter=contract_id, value=invalid-guid",
    };
    assert.strictEqual(
      buildFilter({ kind: "outlineRow", feature, scenario: outline, example }),
      "DisplayName~parameter: %22contract_id%22, value: %22invalid-guid%22",
    );
  });

  it("outline row falls back to scenario filter when strategy is scenarioOnly", () => {
    const outline: ScenarioInfo = {
      name: "Reject invalid GUID values in path parameters",
      tags: [],
      line: 28,
      isOutline: true,
    };
    const example: OutlineExample = {
      rowIndex: 0,
      line: 38,
      headers: ["parameter", "value"],
      values: ["contract_id", "invalid-guid"],
      label: "parameter=contract_id, value=invalid-guid",
    };
    assert.strictEqual(
      buildFilter(
        { kind: "outlineRow", feature, scenario: outline, example },
        { featureClassSuffix: "Feature", tagTraitName: "Category", outlineRowFilter: "scenarioOnly" },
      ),
      "FullyQualifiedName~BuyingPowerFeature.RejectInvalidGUIDValuesInPathParameters",
    );
  });

  it("supports custom tag trait and empty feature class suffix", () => {
    const mapping = { featureClassSuffix: "", tagTraitName: "TestCategory", outlineRowFilter: "displayName" as const };
    assert.strictEqual(buildFilter({ kind: "tag", tag: "Smoke" }, mapping), "TestCategory=Smoke");
    assert.strictEqual(
      buildFilter({ kind: "feature", feature }, mapping),
      "FullyQualifiedName~BuyingPower",
    );
  });
});
