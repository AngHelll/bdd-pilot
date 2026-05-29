import * as assert from "assert";
import { describe, it } from "node:test";
import { deriveDomain, groupByDomain } from "../core/gherkin/grouping";
import { FeatureInfo } from "../core/gherkin/model";

function feature(name: string, filePath: string): FeatureInfo {
  return { name, filePath, tags: [], scenarios: [] };
}

describe("grouping", () => {
  it("derives domain from path after Features folder (plural)", () => {
    assert.strictEqual(
      deriveDomain("/x/Features/Trading/BuyingPower/BuyingPower.feature"),
      "Trading",
    );
  });

  it("derives domain from path after Feature folder (singular)", () => {
    assert.strictEqual(
      deriveDomain("/x/Web.Automation/Feature/TradingMx/Market/Stocks.feature"),
      "TradingMx",
    );
  });

  it("falls back to General when no domain segment (plural and singular)", () => {
    assert.strictEqual(deriveDomain("/x/Features/Login.feature"), "General");
    assert.strictEqual(deriveDomain("/x/Feature/Login.feature"), "General");
  });

  it("groups and sorts by domain then feature name", () => {
    const groups = groupByDomain([
      feature("Withdrawals", "/x/Features/WealthManagement/Withdrawals.feature"),
      feature("Login", "/x/Features/Security/Login.feature"),
      feature("Transfers", "/x/Features/WealthManagement/Transfers.feature"),
    ]);
    assert.deepStrictEqual(groups.map((g) => g.name), ["Security", "WealthManagement"]);
    assert.deepStrictEqual(
      groups[1].features.map((f) => f.name),
      ["Transfers", "Withdrawals"],
    );
  });
});
