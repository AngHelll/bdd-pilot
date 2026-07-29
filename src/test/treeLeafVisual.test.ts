import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildLeafStatusDescription,
  resolveTreeLeafIconKind,
} from "../core/results/treeLeafVisual";

describe("treeLeafVisual", () => {
  it("resolveTreeLeafIconKind distinguishes pending vs not_in_trx vs skipped", () => {
    assert.strictEqual(resolveTreeLeafIconKind(undefined, undefined, false), "pending");
    assert.strictEqual(resolveTreeLeafIconKind(undefined, "not_in_trx", false), "not_in_trx");
    assert.strictEqual(resolveTreeLeafIconKind("skipped", "canceled", false), "canceled");
    assert.strictEqual(resolveTreeLeafIconKind("skipped", undefined, false), "skipped");
    assert.strictEqual(resolveTreeLeafIconKind("failed", undefined, false), "failed");
    assert.strictEqual(resolveTreeLeafIconKind(undefined, undefined, true), "outline");
  });

  it("buildLeafStatusDescription appends skip narrative", () => {
    assert.strictEqual(
      buildLeafStatusDescription(undefined, "skipped", "not_in_trx", "en"),
      "not in results",
    );
    assert.ok(
      buildLeafStatusDescription("@smoke", undefined, "canceled", "en")?.includes("canceled"),
    );
  });

  it("buildLeafStatusDescription pending hint is opt-in", () => {
    assert.strictEqual(
      buildLeafStatusDescription(undefined, undefined, undefined, "en", false),
      undefined,
    );
    assert.strictEqual(
      buildLeafStatusDescription(undefined, undefined, undefined, "en", true),
      "not run",
    );
    assert.strictEqual(
      buildLeafStatusDescription("@a", undefined, undefined, "es", true),
      "@a · sin ejecutar",
    );
  });
});
