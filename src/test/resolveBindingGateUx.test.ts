import * as assert from "assert";
import { describe, it } from "node:test";
import { resolveBindingGateUx } from "../core/bindings/resolveBindingGateUx";
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

describe("resolveBindingGateUx", () => {
  it("proceeds when off or no issues", () => {
    assert.strictEqual(resolveBindingGateUx("off", [unbound], []), "proceed");
    assert.strictEqual(resolveBindingGateUx("warn", [], []), "proceed");
  });

  it("warn mode always modal-warn when issues exist", () => {
    assert.strictEqual(resolveBindingGateUx("warn", [unbound], []), "modal-warn");
    assert.strictEqual(resolveBindingGateUx("warn", [], [ambiguous]), "modal-warn");
    assert.strictEqual(resolveBindingGateUx("warn", [unbound], [ambiguous]), "modal-warn");
  });

  it("block mode: unbound → modal-block; ambiguous only → modal-warn", () => {
    assert.strictEqual(resolveBindingGateUx("block", [unbound], []), "modal-block");
    assert.strictEqual(resolveBindingGateUx("block", [], [ambiguous]), "modal-warn");
    assert.strictEqual(resolveBindingGateUx("block", [unbound], [ambiguous]), "modal-block");
  });
});
