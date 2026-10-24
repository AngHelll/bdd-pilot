import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildLeafStatusDescription,
  formatLeafStoryStrip,
  resolveLeafIconSpec,
  resolveTreeLeafIconKind,
  treeRowDurationMs,
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

  it("tree row shows a passed duration without repeating the outcome word", () => {
    for (const locale of ["en", "es"] as const) {
      assert.strictEqual(
        formatLeafStoryStrip({
          outcome: "passed",
          displayMode: "detailed",
          locale,
          tagsPart: "2 tags",
          durationPart: "1.2 s",
          includeErrorSnippet: false,
        }),
        "1.2 s · 2 tags",
      );
    }
  });

  it("tree row keeps duration on a detailed failure and leaves the snippet off the row", () => {
    const desc = formatLeafStoryStrip({
      outcome: "failed",
      errorSnippet: "Expected true but was false",
      displayMode: "detailed",
      locale: "en",
      tagsPart: "@payment",
      durationPart: "1.2 s",
      featureHint: "Checkout",
      includeErrorSnippet: false,
    });
    assert.strictEqual(desc, "1.2 s · @payment · Checkout");
  });

  it("tree row keeps duration on a compact failure in English and Spanish", () => {
    for (const locale of ["en", "es"] as const) {
      const desc = formatLeafStoryStrip({
        outcome: "failed",
        errorSnippet: "Expected true",
        displayMode: "compact",
        locale,
        durationPart: "450 ms",
        includeErrorSnippet: false,
      });
      assert.strictEqual(desc, "450 ms");
      assert.ok(!desc!.includes("Expected"));
      assert.ok(!desc!.includes("failed"));
      assert.ok(!desc!.includes("fallido"));
    }
  });

  it("tree row omits duration when a failure has none", () => {
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "failed",
        errorSnippet: "Expected true",
        displayMode: "detailed",
        locale: "es",
        tagsPart: "@payment",
        includeErrorSnippet: false,
      }),
      "@payment",
    );
  });

  it("live result without duration does not invent one and keeps the current icon", () => {
    assert.strictEqual(treeRowDurationMs(undefined), undefined);
    assert.strictEqual(treeRowDurationMs(Number.NaN), undefined);
    assert.strictEqual(treeRowDurationMs(-5), undefined);
    assert.strictEqual(treeRowDurationMs(0), 0);
    assert.strictEqual(treeRowDurationMs(1200), 1200);
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "passed",
        displayMode: "compact",
        locale: "en",
        includeErrorSnippet: false,
      }),
      undefined,
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "nativePrecision",
        level: "scenario",
        classicBareOutline: false,
        outcome: "failed",
        skipReason: undefined,
        sessionHasResults: true,
      }),
      { id: "error", color: "failed" },
    );
    assert.deepStrictEqual(
      resolveLeafIconSpec({
        presentation: "classic",
        level: "example",
        classicBareOutline: false,
        outcome: "passed",
        skipReason: undefined,
        sessionHasResults: true,
      }),
      { id: "pass", color: "passed" },
    );
  });

  it("empty session stays neutral and a session with other results says not run", () => {
    assert.strictEqual(
      formatLeafStoryStrip({
        displayMode: "detailed",
        locale: "en",
        tagsPart: "2 tags",
        showPendingHint: false,
        includeErrorSnippet: false,
      }),
      "2 tags",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        displayMode: "detailed",
        locale: "en",
        showPendingHint: true,
        includeErrorSnippet: false,
      }),
      "not run",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        displayMode: "detailed",
        locale: "es",
        showPendingHint: true,
        includeErrorSnippet: false,
      }),
      "sin ejecutar",
    );
  });

  it("tree row keeps skip, cancel, and not-in-results phrases", () => {
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "skipped",
        skipReason: "runner_skipped",
        displayMode: "detailed",
        locale: "en",
        durationPart: "1 s",
        tagsPart: "@smoke",
        includeErrorSnippet: false,
      }),
      "1 s · @smoke · skipped by runner",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "skipped",
        skipReason: "runner_skipped",
        displayMode: "detailed",
        locale: "es",
        durationPart: "1 s",
        includeErrorSnippet: false,
      }),
      "1 s · omitido por el runner",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        skipReason: "canceled",
        displayMode: "compact",
        locale: "en",
        durationPart: "1 s",
        tagsPart: "@smoke",
        includeErrorSnippet: false,
      }),
      "canceled before completion · 1 s",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        skipReason: "canceled",
        displayMode: "detailed",
        locale: "es",
        includeErrorSnippet: false,
      }),
      "cancelado antes de terminar",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        skipReason: "not_in_trx",
        displayMode: "detailed",
        locale: "en",
        tagsPart: "@smoke",
        includeErrorSnippet: false,
      }),
      "not in results · @smoke",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        skipReason: "not_in_trx",
        displayMode: "compact",
        locale: "es",
        durationPart: "800 ms",
        includeErrorSnippet: false,
      }),
      "sin resultado · 800 ms",
    );
  });

  it("example row uses its own duration", () => {
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "passed",
        displayMode: "detailed",
        locale: "en",
        durationPart: "20 ms",
        includeErrorSnippet: false,
      }),
      "20 ms",
    );
    assert.strictEqual(
      formatLeafStoryStrip({
        outcome: "failed",
        errorSnippet: "Expected 2",
        displayMode: "compact",
        locale: "es",
        durationPart: "15 ms",
        includeErrorSnippet: false,
      }),
      "15 ms",
    );
  });
});
