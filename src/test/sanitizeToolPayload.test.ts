import * as assert from "assert";
import { describe, it } from "node:test";
import { sanitizeToolPayload } from "../security/sanitizeToolPayload";

describe("sanitizeToolPayload", () => {
  it("sanitizes nested string fields", () => {
    const input = {
      markdown: "password=secret",
      summary: { failed: 1 },
      nested: [{ detail: "token=abc123" }],
    };
    const out = sanitizeToolPayload(input);
    assert.ok(!JSON.stringify(out).includes("secret"));
    assert.ok(!JSON.stringify(out).includes("abc123"));
    assert.ok(JSON.stringify(out).includes("***REDACTED***"));
  });
});
