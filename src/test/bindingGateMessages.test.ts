import * as assert from "assert";
import { describe, it } from "node:test";
import {
  formatBindingGateAmbiguousOutput,
  formatBindingGateUnboundPrompt,
} from "../core/bindings/bindingGateMessages";
import { BindingGateIssue } from "../core/bindings/evaluateBindingGate";

describe("bindingGateMessages", () => {
  const unbound: BindingGateIssue = {
    featurePath: "/proj/Features/Pay.feature",
    line0: 9,
    scenarioName: "Pay",
    stepText: "When I pay",
    status: "unbound",
  };

  const ambiguous: BindingGateIssue = {
    featurePath: "/proj/Features/Pay.feature",
    line0: 11,
    scenarioName: "Pay",
    stepText: "Then I see receipt",
    status: "ambiguous",
  };

  it("formats unbound prompt with 1-based line numbers", () => {
    const message = formatBindingGateUnboundPrompt("en", [unbound]);
    assert.match(message, /1 unbound step/);
    assert.match(message, /\[unbound\]/);
    assert.match(message, /line 10/);
    assert.match(message, /When I pay/);
    assert.doesNotMatch(message, /ambiguous/i);
  });

  it("formats ambiguous output without unbound summary", () => {
    const message = formatBindingGateAmbiguousOutput("en", [ambiguous]);
    assert.match(message, /1 ambiguous binding/);
    assert.match(message, /\[ambiguous\]/);
    assert.match(message, /line 12/);
    assert.match(message, /Then I see receipt/);
    assert.doesNotMatch(message, /unbound/i);
  });

  it("uses Spanish issue labels in ambiguous output", () => {
    const message = formatBindingGateAmbiguousOutput("es", [ambiguous]);
    assert.match(message, /\[ambiguo\]/);
    assert.doesNotMatch(message, /\[ambiguous\]/);
  });

  it("truncates unbound prompt with +N more", () => {
    const issues: BindingGateIssue[] = Array.from({ length: 10 }, (_, i) => ({
      featurePath: `/f${i}.feature`,
      line0: i,
      scenarioName: "S",
      stepText: `step ${i}`,
      status: "unbound" as const,
    }));
    const message = formatBindingGateUnboundPrompt("en", issues);
    assert.match(message, /\+2 more/);
  });
});
