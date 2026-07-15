import * as assert from "assert";
import { describe, it } from "node:test";
import { evaluateRun } from "../security/envGuard";
import { sanitize } from "../security/sanitizer";
import { sanitizeToolPayload } from "../security/sanitizeToolPayload";

describe("envGuard", () => {
  it("does not require confirmation for non-protected stages", () => {
    const decision = evaluateRun("dev", ["stg", "prod"]);
    assert.strictEqual(decision.denied, false);
    assert.strictEqual(decision.requiresConfirmation, false);
  });

  it("requires confirmation for stg and prod when production allowed", () => {
    assert.strictEqual(evaluateRun("stg", ["stg", "prod"]).requiresConfirmation, true);
    assert.strictEqual(evaluateRun("stg", ["stg", "prod"]).messageKey, "envGuard.stageConfirm");
    const prod = evaluateRun("prod", ["stg", "prod"], { allowProductionRuns: true });
    assert.strictEqual(prod.denied, false);
    assert.strictEqual(prod.requiresConfirmation, true);
    assert.strictEqual(prod.messageKey, "envGuard.prodConfirm");
  });

  it("denies prod when allowProductionRuns is false", () => {
    const denied = evaluateRun("prod", ["stg", "prod"], { allowProductionRuns: false });
    assert.strictEqual(denied.denied, true);
    assert.strictEqual(denied.requiresConfirmation, false);
    assert.strictEqual(denied.messageKey, "envGuard.prodBlocked");
  });

  it("does not apply production opt-in gate to stg", () => {
    const stg = evaluateRun("stg", ["stg", "prod"], { allowProductionRuns: false });
    assert.strictEqual(stg.denied, false);
    assert.strictEqual(stg.requiresConfirmation, true);
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
    assert.ok(out.includes("***REDACTED***"));
  });

  it("redacts JWT-like bearer tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc";
    const out = sanitize(`Authorization header ${jwt} end`);
    assert.ok(!out.includes(jwt));
    assert.ok(out.includes("***REDACTED***"));
  });

  it("redacts AWS access key ids", () => {
    const key = "AKIAIOSFODNN7EXAMPLE";
    const out = sanitize(`aws_access_key_id=${key}`);
    assert.ok(!out.includes(key));
    assert.ok(out.includes("***REDACTED***"));
  });

  it("redacts PEM private key blocks", () => {
    const pem = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF6PZGBw=",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const out = sanitize(`key material\n${pem}\nok`);
    assert.ok(!out.includes("MIIEowIBAAKCAQEA"));
    assert.ok(!out.includes("BEGIN RSA PRIVATE KEY"));
    assert.ok(out.includes("***REDACTED***"));
  });

  it("redacts generic secret= assignments", () => {
    const out = sanitize("Secret=super-secret-value");
    assert.ok(!out.includes("super-secret-value"));
    assert.ok(out.includes("Secret="));
  });

  it("leaves benign text untouched", () => {
    assert.strictEqual(sanitize("Running 24 tests in parallel"), "Running 24 tests in parallel");
  });

  it("sanitizeToolPayload redacts nested string leaves", () => {
    const payload = {
      ok: true,
      nested: { line: "password=hunter2", note: "plain" },
      list: ["token=abc"],
    };
    const out = sanitizeToolPayload(payload);
    assert.strictEqual(out.nested.note, "plain");
    assert.ok(!JSON.stringify(out).includes("hunter2"));
    assert.ok(!JSON.stringify(out).includes("abc"));
    assert.ok(JSON.stringify(out).includes("***REDACTED***"));
  });
});
