import * as assert from "assert";
import { describe, it } from "node:test";
import { computeRollup, formatRollupDescription, rollupSeverity } from "../core/gherkin/outcomeRollup";
import { FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import {
  findOutlineExampleMatch,
  findOutlineExampleMatchInFeature,
  matchesOutlineExample,
  matchesOutlineExampleTheory,
  matchesScenario,
  matchesScenarioInFeature,
} from "../core/results/scenarioMatch";

describe("outcomeRollup", () => {
  it("aggregates child outcomes", () => {
    const rollup = computeRollup(["passed", "failed", "passed"]);
    assert.strictEqual(rollup.passed, 2);
    assert.strictEqual(rollup.failed, 1);
    assert.strictEqual(rollup.withResults, 3);
    assert.strictEqual(formatRollupDescription(rollup), "1 failed · 2 passed");
    assert.strictEqual(rollupSeverity(rollup), "failed");
  });

  it("counts unknown as withResults without affecting pass/fail counts", () => {
    const rollup = computeRollup(["unknown", "passed"]);
    assert.strictEqual(rollup.withResults, 2);
    assert.strictEqual(rollup.passed, 1);
    assert.strictEqual(rollup.failed, 0);
    assert.strictEqual(rollupSeverity(rollup), "passed");
  });
});

describe("scenarioMatch outline", () => {
  const example = {
    rowIndex: 0,
    line: 38,
    headers: ["parameter", "value"],
    values: ["contract_id", "invalid-guid"],
    label: "parameter=contract_id, value=invalid-guid",
  };

  it("matches theory test names containing example values", () => {
    const testName =
      "TradingBuyingPowerFeature.RejectInvalidGUIDValuesInPathParameters(contract_id, invalid-guid, Guid contractId)";
    assert.ok(matchesOutlineExample(testName, example));
    assert.ok(
      findOutlineExampleMatch(testName, "Reject invalid GUID values in path parameters", [example]),
    );
  });
});

describe("scenarioMatch FQN-first", () => {
  const orders: FeatureInfo = {
    name: "Orders",
    filePath: "/proj/Orders.feature",
    tags: [],
    scenarios: [],
  };
  const reports: FeatureInfo = {
    name: "Reports",
    filePath: "/proj/Reports.feature",
    tags: [],
    scenarios: [],
  };
  const placeOrder: ScenarioInfo = {
    name: "Place order",
    tags: [],
    line: 5,
    isOutline: false,
  };
  const placeOrderBatch: ScenarioInfo = {
    name: "Place order batch",
    tags: [],
    line: 12,
    isOutline: false,
  };

  it("matches same-title scenarios only on the feature class FQN", () => {
    assert.ok(matchesScenarioInFeature("OrdersFeature.PlaceOrder", orders, placeOrder));
    assert.ok(!matchesScenarioInFeature("OrdersFeature.PlaceOrder", reports, placeOrder));
    assert.ok(matchesScenarioInFeature("ReportsFeature.PlaceOrder", reports, placeOrder));
  });

  it("does not attribute prefix siblings via FQN", () => {
    assert.ok(matchesScenarioInFeature("OrdersFeature.PlaceOrder", orders, placeOrder));
    assert.ok(!matchesScenarioInFeature("OrdersFeature.PlaceOrder", orders, placeOrderBatch));
    assert.ok(
      matchesScenarioInFeature("OrdersFeature.PlaceOrderBatch", orders, placeOrderBatch),
    );
    // Legacy includes still collides — documenting why FQN path matters:
    assert.ok(matchesScenario("OrdersFeature.PlaceOrderBatch", "Place order"));
  });

  it("falls back to includes when feature class token is absent", () => {
    assert.ok(
      matchesScenarioInFeature(
        "TotallyUnrelated.LoginUserWithValidCredentials",
        orders,
        { name: "Login user with valid credentials", tags: [], line: 1, isOutline: false },
      ),
    );
  });
});

describe("scenarioMatch Theory outline", () => {
  const feature: FeatureInfo = {
    name: "Calculator",
    filePath: "/proj/Calculator.feature",
    tags: [],
    scenarios: [],
  };
  const scenario: ScenarioInfo = {
    name: "Add two numbers",
    tags: [],
    line: 4,
    isOutline: true,
  };
  const row0 = {
    rowIndex: 0,
    line: 10,
    headers: ["first", "second", "result"],
    values: ["1", "2", "3"],
    label: "first=1, second=2, result=3",
  };
  const row1 = {
    rowIndex: 1,
    line: 11,
    headers: ["first", "second", "result"],
    values: ["4", "5", "9"],
    label: "first=4, second=5, result=9",
  };

  it("matches Outline row via Theory named params", () => {
    const testName =
      'Ns.CalculatorFeature.AddTwoNumbers(first: "1", second: "2", result: "3", exampleTags: [])';
    assert.strictEqual(matchesOutlineExampleTheory(testName, row0), true);
    assert.strictEqual(matchesOutlineExampleTheory(testName, row1), false);
    const match = findOutlineExampleMatchInFeature(testName, feature, scenario, [row0, row1]);
    assert.ok(match);
    assert.strictEqual(match!.rowIndex, 0);
  });

  it("falls back to cell substring when Theory parse fails", () => {
    const testName = "CalculatorFeature.AddTwoNumbers(1, 2, 3)";
    assert.strictEqual(matchesOutlineExampleTheory(testName, row0), undefined);
    assert.ok(matchesOutlineExample(testName, row0));
  });
});
