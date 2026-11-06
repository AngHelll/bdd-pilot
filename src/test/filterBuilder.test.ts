import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildCombinedFilter,
  buildFilter,
  featureClassName,
  sanitizeIdentifier,
  selectionHasIndistinguishableOutlineRow,
  RunTarget,
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

  it("sanitizeIdentifier aligns hyphens with Reqnroll (underscore in class name)", () => {
    assert.strictEqual(sanitizeIdentifier("Pre-order"), "Pre_Order");
    assert.strictEqual(sanitizeIdentifier("E-Commerce"), "E_Commerce");
    assert.strictEqual(
      buildFilter({
        kind: "feature",
        feature: { ...feature, name: "E-Commerce" },
      }),
      "FullyQualifiedName~E_CommerceFeature",
    );
    assert.strictEqual(
      buildFilter({
        kind: "scenario",
        feature: { ...feature, name: "Pre-order" },
        scenario: { ...scenario, name: "Check out flow" },
      }),
      "FullyQualifiedName~Pre_OrderFeature.CheckOutFlow",
    );
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
      "(FullyQualifiedName~BuyingPowerFeature.RejectInvalidGUIDValuesInPathParameters&DisplayName~parameter: %22contract_id%22, value: %22invalid-guid%22)",
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

  it("keeps First/day distinct from Second/day", () => {
    const rowFeature: FeatureInfo = {
      name: "Row selection",
      filePath: "/x/Row.feature",
      tags: [],
      scenarios: [],
    };
    const day = (name: string): RunTarget => ({
      kind: "outlineRow",
      feature: rowFeature,
      scenario: { name, tags: [], line: 2, isOutline: true },
      example: {
        rowIndex: 0,
        line: 6,
        headers: ["period"],
        values: ["day"],
        label: "period=day",
      },
    });
    const first = buildFilter(day("First operation"));
    const second = buildFilter(day("Second operation"));
    assert.strictEqual(
      first,
      "(FullyQualifiedName~RowSelectionFeature.FirstOperation&DisplayName~period: %22day%22)",
    );
    assert.strictEqual(
      second,
      "(FullyQualifiedName~RowSelectionFeature.SecondOperation&DisplayName~period: %22day%22)",
    );
    assert.notStrictEqual(first, second);
    assert.strictEqual(
      buildCombinedFilter([day("First operation"), day("Second operation")]),
      `${first}|${second}`,
    );
  });

  it("ORs two different rows of one scenario without collapsing to the scenario", () => {
    const outline: ScenarioInfo = {
      name: "Read items",
      tags: [],
      line: 2,
      isOutline: true,
    };
    const row = (value: string, rowIndex: number): RunTarget => ({
      kind: "outlineRow",
      feature,
      scenario: outline,
      example: {
        rowIndex,
        line: 8 + rowIndex,
        headers: ["kind"],
        values: [value],
        label: `kind=${value}`,
      },
    });
    const combined = buildCombinedFilter([row("a", 0), row("b", 1)]);
    assert.ok(combined?.startsWith("(FullyQualifiedName~BuyingPowerFeature.ReadItems&"));
    assert.ok(combined?.includes("|"));
    assert.ok(!combined?.endsWith("FullyQualifiedName~BuyingPowerFeature.ReadItems"));
    assert.strictEqual(
      combined,
      "(FullyQualifiedName~BuyingPowerFeature.ReadItems&DisplayName~kind: %22a%22)|(FullyQualifiedName~BuyingPowerFeature.ReadItems&DisplayName~kind: %22b%22)",
    );
  });

  it("reports identical cells in one scenario and ignores the same cells in another", () => {
    const day = {
      rowIndex: 0,
      line: 6,
      headers: ["period"],
      values: ["day"],
      label: "period=day",
    };
    const sameScenario: ScenarioInfo = {
      name: "First operation",
      tags: [],
      line: 2,
      isOutline: true,
      examples: [day, { ...day, rowIndex: 1, line: 7 }],
    };
    const rowFeature: FeatureInfo = {
      name: "Row selection",
      filePath: "/x/Row.feature",
      tags: [],
      scenarios: [],
    };
    assert.strictEqual(
      selectionHasIndistinguishableOutlineRow([
        { kind: "outlineRow", feature: rowFeature, scenario: sameScenario, example: day },
      ]),
      true,
    );
    const unique: ScenarioInfo = {
      name: "First operation",
      tags: [],
      line: 2,
      isOutline: true,
      examples: [day, { ...day, rowIndex: 1, line: 7, values: ["week"], label: "period=week" }],
    };
    assert.strictEqual(
      selectionHasIndistinguishableOutlineRow([
        { kind: "outlineRow", feature: rowFeature, scenario: unique, example: day },
      ]),
      false,
    );
  });
});
