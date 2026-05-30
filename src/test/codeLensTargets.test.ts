import * as assert from "assert";
import { describe, it } from "node:test";
import { buildCodeLensTargets } from "../providers/codeLensTargets";

describe("codeLensTargets", () => {
  it("creates outline row targets for Examples data lines", () => {
    const content = [
      "Feature: Trading Buying Power",
      "  Scenario Outline: Reject invalid GUID values in path parameters",
      "    When I use <parameter> with <value>",
      "    Examples:",
      "      | parameter   | value        | expected_message |",
      "      | contract_id | invalid-guid | Guid contractId  |",
      "      | account_id  | 3            | Guid accountId   |",
    ].join("\n");

    const targets = buildCodeLensTargets("/x/BuyingPower.feature", content);
    const rowTargets = targets.filter((t) => t.target.kind === "outlineRow");
    assert.strictEqual(rowTargets.length, 2);
    const first = rowTargets[0].target;
    assert.strictEqual(first.kind, "outlineRow");
    if (first.kind === "outlineRow") {
      assert.strictEqual(first.example.label, "parameter=contract_id, value=invalid-guid +1");
      assert.strictEqual(first.example.line, 6);
    }
  });
});
