import * as assert from "assert";
import { describe, it } from "node:test";
import {
  resolveUnboundPromptKind,
  shouldLogAmbiguousIssues,
  shouldPromptForUnboundIssues,
} from "../core/bindings/bindingGatePresentation";
import { BindingGateIssue } from "../core/bindings/evaluateBindingGate";

const unbound: BindingGateIssue = {
  featurePath: "/a.feature",
  line0: 1,
  scenarioName: "S",
  stepText: "When x",
  status: "unbound",
};

const ambiguous: BindingGateIssue = {
  featurePath: "/a.feature",
  line0: 2,
  scenarioName: "S",
  stepText: "Then y",
  status: "ambiguous",
};

describe("bindingGatePresentation", () => {
  it("logs ambiguous issues when present", () => {
    assert.strictEqual(shouldLogAmbiguousIssues([]), false);
    assert.strictEqual(shouldLogAmbiguousIssues([ambiguous]), true);
  });

  it("prompts only when unbound issues exist", () => {
    assert.strictEqual(shouldPromptForUnboundIssues([]), false);
    assert.strictEqual(shouldPromptForUnboundIssues([unbound]), true);
  });

  it("maps ux to non-modal warn or block modal", () => {
    assert.strictEqual(resolveUnboundPromptKind("proceed"), undefined);
    assert.strictEqual(resolveUnboundPromptKind("modal-warn"), "warn-non-modal");
    assert.strictEqual(resolveUnboundPromptKind("modal-block"), "block-modal");
  });
});
