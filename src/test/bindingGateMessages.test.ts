import * as assert from "assert";
import { describe, it } from "node:test";
import {
  formatBindingGateAmbiguousOutput,
  formatBindingGateUnboundPrompt,
  formatBindingGateUnboundTerminal,
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

  it("formats unbound prompt as one sentence without step lines", () => {
    const message = formatBindingGateUnboundPrompt("en", [unbound]);
    assert.strictEqual(
      message,
      "1 steps have no binding. Tests will not start unless you choose Run anyway.",
    );
    assert.doesNotMatch(message, /When I pay/);
    assert.doesNotMatch(message, /\+1 more/);
    assert.doesNotMatch(message, /Before running tests/);
  });

  it("formats the block prompt as one sentence", () => {
    const message = formatBindingGateUnboundPrompt("es", [unbound], "block");
    assert.strictEqual(message, "1 steps sin binding. No inicia.");
    assert.doesNotMatch(message, /When I pay/);
    assert.doesNotMatch(message, /Antes de ejecutar tests/);
  });

  it("keeps unbound step lines on the terminal text", () => {
    const message = formatBindingGateUnboundTerminal("en", [unbound]);
    assert.match(message, /\[bdd-pilot\] Binding check:/);
    assert.match(message, /\[unbound\]/);
    assert.match(message, /line 10/);
    assert.match(message, /When I pay/);
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

  it("truncates unbound terminal lines with +N more", () => {
    const issues: BindingGateIssue[] = Array.from({ length: 10 }, (_, i) => ({
      featurePath: `/f${i}.feature`,
      line0: i,
      scenarioName: "S",
      stepText: `step ${i}`,
      status: "unbound" as const,
    }));
    const terminal = formatBindingGateUnboundTerminal("en", issues);
    assert.match(terminal, /\+2 more/);
    const prompt = formatBindingGateUnboundPrompt("en", issues);
    assert.doesNotMatch(prompt, /step 0/);
    assert.doesNotMatch(prompt, /\+2 more/);
  });
});
