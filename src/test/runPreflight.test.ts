import * as assert from "assert";
import { describe, it } from "node:test";
import { formatRunNotStartedLines } from "../core/bindings/runPreflight";
import {
  shouldLogAmbiguousIssues,
  shouldPromptForUnboundIssues,
} from "../core/bindings/bindingGatePresentation";
import { BindingGateIssue } from "../core/bindings/evaluateBindingGate";
import { evaluateRun } from "../security/envGuard";

describe("runPreflight", () => {
  it("formats run-not-started lines for stage decline", () => {
    const lines = formatRunNotStartedLines("en", "stage-declined");
    assert.deepStrictEqual(lines, [
      "[bdd-pilot] Run not started.",
      "[bdd-pilot] Stage confirmation declined.",
    ]);
  });

  it("formats run-not-started lines for gate decline in Spanish", () => {
    const lines = formatRunNotStartedLines("es", "gate-declined");
    assert.deepStrictEqual(lines, [
      "[bdd-pilot] Ejecución no iniciada.",
      "[bdd-pilot] Compuerta de bindings rechazada.",
    ]);
  });

  it("requires stage confirmation only for protected stages", () => {
    assert.strictEqual(evaluateRun("dev", ["stg", "prod"]).requiresConfirmation, false);
    assert.strictEqual(evaluateRun("prod", ["stg", "prod"]).requiresConfirmation, true);
  });

  const ambiguous: BindingGateIssue = {
    featurePath: "/a.feature",
    line0: 1,
    scenarioName: "S",
    stepText: "Then y",
    status: "ambiguous",
  };

  const unbound: BindingGateIssue = {
    featurePath: "/a.feature",
    line0: 0,
    scenarioName: "S",
    stepText: "When x",
    status: "unbound",
  };

  it("proceeds through binding gate policy when only ambiguous issues exist", () => {
    assert.strictEqual(shouldPromptForUnboundIssues([]), false);
    assert.strictEqual(shouldLogAmbiguousIssues([ambiguous]), true);
  });

  it("blocks binding gate policy when unbound issues exist", () => {
    assert.strictEqual(shouldPromptForUnboundIssues([unbound]), true);
  });
});
