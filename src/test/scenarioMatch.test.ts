import * as assert from "assert";
import { describe, it } from "node:test";
import { computeRollup, formatRollupDescription, rollupSeverity } from "../core/gherkin/outcomeRollup";
import { findOutlineExampleMatch, matchesOutlineExample } from "../core/results/scenarioMatch";

describe("outcomeRollup", () => {
  it("aggregates child outcomes", () => {
    const rollup = computeRollup(["passed", "failed", "passed"]);
    assert.strictEqual(rollup.passed, 2);
    assert.strictEqual(rollup.failed, 1);
    assert.strictEqual(rollup.withResults, 3);
    assert.strictEqual(formatRollupDescription(rollup), "1 failed · 2 passed");
    assert.strictEqual(rollupSeverity(rollup), "failed");
  });
});

describe("scenarioMatch outline", () => {
  const example = {
    rowIndex: 0,
    headers: ["parameter", "value"],
    values: ["contract_id", "invalid-guid"],
    label: "parameter=contract_id, value=invalid-guid",
  };

  it("matches theory test names containing example values", () => {
    const testName =
      "TradingBuyingPowerFeature.RejectInvalidGUIDValuesInPathParameters(contract_id, invalid-guid, Guid contractId)";
    assert.ok(matchesOutlineExample(testName, example));
    assert.ok(findOutlineExampleMatch(testName, "Reject invalid GUID values in path parameters", [example]));
  });
});
