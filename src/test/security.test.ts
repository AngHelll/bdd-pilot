import * as assert from "assert";
import { describe, it } from "node:test";
import { evaluateRun } from "../security/envGuard";
import { sanitize } from "../security/sanitizer";

describe("envGuard", () => {
  it("does not require confirmation for non-protected stages", () => {
    const decision = evaluateRun("dev", ["stg", "prod"]);
    assert.strictEqual(decision.requiresConfirmation, false);
  });

  it("requires confirmation for stg and prod", () => {
    assert.strictEqual(evaluateRun("stg", ["stg", "prod"]).requiresConfirmation, true);
    assert.strictEqual(evaluateRun("stg", ["stg", "prod"]).messageKey, "envGuard.stageConfirm");
    const prod = evaluateRun("prod", ["stg", "prod"]);
    assert.strictEqual(prod.requiresConfirmation, true);
    assert.strictEqual(prod.messageKey, "envGuard.prodConfirm");
  });
});

describe("sanitizer", () => {
  it("redacts client secrets and tokens", () => {
    const input = "client_secret=abc123 password: hunter2 token=xyz";
    const out = sanitize(input);
    assert.ok(!out.includes("abc123"));
    assert.ok(!out.includes("hunter2"));
    assert.ok(!out.includes("xyz"));
    assert.ok(out.includes("client_secret="));
  });

  it("redacts JWT-like bearer tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc";
    const out = sanitize(`Authorization header ${jwt} end`);
    assert.ok(!out.includes(jwt));
  });

  it("leaves benign text untouched", () => {
    assert.strictEqual(sanitize("Running 24 tests in parallel"), "Running 24 tests in parallel");
  });
});
