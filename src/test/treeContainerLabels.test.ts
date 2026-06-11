import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildContainerDescription,
  buildOutlineParentDescription,
  effectiveLeafTagDisplay,
  shouldTintContainerIcon,
} from "../core/gherkin/treeContainerLabels";

const passedRollup = { passed: 5, failed: 0, skipped: 0, withResults: 5 };
const failedRollup = { passed: 3, failed: 2, skipped: 0, withResults: 5 };
const structural = "2 features · 3 scenarios";

describe("treeContainerLabels", () => {
  it("buildContainerDescription compact omits passed rollup", () => {
    assert.strictEqual(
      buildContainerDescription("compact", passedRollup, structural, "en"),
      structural,
    );
  });

  it("buildContainerDescription compact prepends rollup when failed", () => {
    const msg = buildContainerDescription("compact", failedRollup, structural, "en");
    assert.ok(msg.startsWith("2 failed"));
    assert.ok(msg.includes(structural));
  });

  it("buildContainerDescription detailed always prepends rollup", () => {
    const msg = buildContainerDescription("detailed", passedRollup, structural, "en");
    assert.ok(msg.startsWith("5 passed"));
    assert.ok(msg.includes(structural));
  });

  it("buildContainerDescription detailed localizes rollup", () => {
    const msg = buildContainerDescription("detailed", passedRollup, structural, "es");
    assert.ok(msg.startsWith("5 correctos"));
  });

  it("shouldTintContainerIcon compact only when failed", () => {
    assert.strictEqual(shouldTintContainerIcon("compact", passedRollup), false);
    assert.strictEqual(shouldTintContainerIcon("compact", failedRollup), true);
    assert.strictEqual(shouldTintContainerIcon("detailed", passedRollup), true);
  });

  it("buildOutlineParentDescription compact shows row count", () => {
    assert.strictEqual(
      buildOutlineParentDescription("compact", passedRollup, 2, "en"),
      "2 rows",
    );
  });

  it("buildOutlineParentDescription compact ES plural", () => {
    assert.strictEqual(
      buildOutlineParentDescription("compact", passedRollup, 1, "es"),
      "1 fila",
    );
  });

  it("buildOutlineParentDescription detailed uses rollup", () => {
    const msg = buildOutlineParentDescription("detailed", failedRollup, 2, "en", "6 tags");
    assert.ok(msg.includes("2 failed"));
    assert.ok(msg.includes("6 tags"));
  });

  it("effectiveLeafTagDisplay hides tags in compact", () => {
    assert.strictEqual(effectiveLeafTagDisplay("compact", "count"), "hidden");
    assert.strictEqual(effectiveLeafTagDisplay("detailed", "count"), "count");
  });
});
