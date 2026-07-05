import * as assert from "assert";
import { describe, it } from "node:test";
import { formatBindingGateModalMessage } from "../core/bindings/bindingGateMessages";
import { BindingGateIssue } from "../core/bindings/evaluateBindingGate";

describe("bindingGateMessages", () => {
  it("formats summary and issue lines with 1-based line numbers", () => {
    const unbound: BindingGateIssue = {
      featurePath: "/proj/Features/Pay.feature",
      line0: 9,
      scenarioName: "Pay",
      stepText: "When I pay",
      status: "unbound",
    };
    const message = formatBindingGateModalMessage("en", [unbound], []);
    assert.match(message, /1 binding issue/);
    assert.match(message, /\[unbound\]/);
    assert.match(message, /line 10/);
    assert.match(message, /When I pay/);
  });

  it("truncates with +N more", () => {
    const issues: BindingGateIssue[] = Array.from({ length: 10 }, (_, i) => ({
      featurePath: `/f${i}.feature`,
      line0: i,
      scenarioName: "S",
      stepText: `step ${i}`,
      status: "unbound" as const,
    }));
    const message = formatBindingGateModalMessage("en", issues, []);
    assert.match(message, /\+2 more/);
  });
});
