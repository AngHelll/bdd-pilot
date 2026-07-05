import * as assert from "assert";
import { describe, it } from "node:test";
import {
  toReqnrollIdentifier,
  toReqnrollIdentifierPart,
} from "../core/runner/reqnrollIdentifier";

describe("reqnrollIdentifier", () => {
  it("toReqnrollIdentifierPart converts hyphens to underscores", () => {
    assert.strictEqual(toReqnrollIdentifierPart("Pre-order"), "Pre_Order");
    assert.strictEqual(toReqnrollIdentifierPart("E-Commerce"), "E_Commerce");
    assert.strictEqual(toReqnrollIdentifierPart("OAuth-2.0"), "OAuth_2_0");
  });

  it("toReqnrollIdentifierPart preserves space-separated PascalCase", () => {
    assert.strictEqual(toReqnrollIdentifierPart("Buying Power"), "BuyingPower");
    assert.strictEqual(toReqnrollIdentifierPart("Smoke"), "Smoke");
  });

  it("toReqnrollIdentifier prefixes digit-leading identifiers", () => {
    assert.strictEqual(toReqnrollIdentifier("2FA login"), "_2FALogin");
  });
});
