import * as assert from "assert";
import { describe, it } from "node:test";
import {
  PRE_RUN_FILTER_MAX_CHARS,
  formatPreRunDrySummary,
  truncatePreRunFilter,
} from "../core/runner/preRunDrySummary";

describe("formatPreRunDrySummary", () => {
  it("joins estimated count and filter", () => {
    const line = formatPreRunDrySummary("en", {
      estimatedCount: 12,
      filter: "Category=smoke",
      scopeLabel: "all tests",
    });
    assert.strictEqual(line, "12 tests (estimated) · Category=smoke");
  });

  it("omits count and keeps filter plus scope when N is unknown", () => {
    const line = formatPreRunDrySummary("en", {
      filter: "FullyQualifiedName~LoginFeature",
      scopeLabel: "login.feature (feature)",
    });
    assert.strictEqual(
      line,
      "FullyQualifiedName~LoginFeature · login.feature (feature)",
    );
  });

  it("uses scope when there is no filter", () => {
    const line = formatPreRunDrySummary("es", {
      estimatedCount: 3,
      scopeLabel: "all tests",
    });
    assert.strictEqual(line, "3 tests (estimados) · all tests");
  });

  it("returns undefined when there is nothing to show", () => {
    assert.strictEqual(formatPreRunDrySummary("en", {}), undefined);
    assert.strictEqual(formatPreRunDrySummary("en", { filter: "  " }), undefined);
  });

  it("truncates long filters at ~120 characters", () => {
    const filter = "FullyQualifiedName~" + "A".repeat(200);
    const truncated = truncatePreRunFilter(filter);
    assert.strictEqual(truncated.length, PRE_RUN_FILTER_MAX_CHARS);
    assert.ok(truncated.endsWith("…"));

    const line = formatPreRunDrySummary("en", { filter });
    assert.strictEqual(line, truncated);
  });
});
