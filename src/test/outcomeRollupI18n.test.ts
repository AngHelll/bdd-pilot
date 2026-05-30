import * as assert from "assert";
import { describe, it } from "node:test";
import { computeRollup, formatRollupDescriptionLocalized, prependRollupLocalized } from "../core/gherkin/outcomeRollup";

describe("outcomeRollup i18n", () => {
  it("formatRollupDescriptionLocalized returns undefined with no results", () => {
    assert.strictEqual(formatRollupDescriptionLocalized(computeRollup([]), "en"), undefined);
  });

  it("formatRollupDescriptionLocalized orders failed before passed in EN", () => {
    const rollup = computeRollup(["failed", "passed", "passed"]);
    assert.strictEqual(formatRollupDescriptionLocalized(rollup, "en"), "1 failed · 2 passed");
  });

  it("formatRollupDescriptionLocalized uses Spanish labels", () => {
    const rollup = computeRollup(["failed", "skipped"]);
    assert.strictEqual(formatRollupDescriptionLocalized(rollup, "es"), "1 fallidos · 1 omitidos");
  });

  it("prependRollupLocalized prepends to base description", () => {
    const rollup = computeRollup(["passed", "passed"]);
    assert.strictEqual(
      prependRollupLocalized("2 scenarios", rollup, "en"),
      "2 passed · 2 scenarios",
    );
  });
});
