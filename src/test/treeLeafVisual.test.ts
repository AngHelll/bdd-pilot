import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildLeafStatusDescription,
  formatLeafStoryStrip,
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

  it("formatLeafStoryStrip prefers failed snippet over skip and tags", () => {
    const desc = formatLeafStoryStrip({
      outcome: "failed",
      skipReason: "not_in_trx",
      errorSnippet: "Expected true",
      displayMode: "detailed",
      locale: "en",
      tagsPart: "@smoke",
      durationPart: "2.3 s",
    });
    assert.strictEqual(desc, "failed · Expected true · 2.3 s · @smoke");
  });

  it("formatLeafStoryStrip compact omits tags and duration on failed", () => {
    const desc = formatLeafStoryStrip({
      outcome: "failed",
      errorSnippet: "Expected true",
      displayMode: "compact",
      locale: "en",
      tagsPart: "@smoke",
      durationPart: "2.3 s",
    });
    assert.strictEqual(desc, "failed · Expected true");
    assert.ok(!desc!.includes("@smoke"));
  });

  it("formatLeafStoryStrip compact omits tags on narrative skip", () => {
    const desc = formatLeafStoryStrip({
      skipReason: "not_in_trx",
      displayMode: "compact",
      locale: "en",
      tagsPart: "@smoke",
      durationPart: "1 s",
    });
    assert.strictEqual(desc, "not in results · 1 s");
  });

  it("formatLeafStoryStrip passed compact does not invent a fail strip", () => {
    const desc = formatLeafStoryStrip({
      outcome: "passed",
      displayMode: "compact",
      locale: "en",
      tagsPart: "@smoke",
      durationPart: "400 ms",
    });
    assert.strictEqual(desc, "400 ms · @smoke");
  });
});
