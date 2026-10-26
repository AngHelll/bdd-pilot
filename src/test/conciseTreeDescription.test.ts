import * as assert from "assert";
import { describe, it } from "node:test";
import {
  conciseContainerDescription,
  conciseLeafDescription,
} from "../core/gherkin/conciseTreeDescription";
import { OutcomeRollup } from "../core/gherkin/outcomeRollup";

const mixed: OutcomeRollup = { passed: 4, failed: 2, skipped: 1, withResults: 7 };
const passedOnly: OutcomeRollup = { passed: 3, failed: 0, skipped: 0, withResults: 3 };

describe("conciseTreeDescription", () => {
  it("shows only the failure count when a container has mixed results", () => {
    assert.strictEqual(conciseContainerDescription(mixed, "en"), "2 failed");
    assert.strictEqual(conciseContainerDescription(mixed, "es"), "2 fallidos");
    assert.doesNotMatch(conciseContainerDescription(mixed, "en"), /passed|skipped|scenario|tag/i);
  });

  it("leaves a container with no failures undescribed", () => {
    assert.strictEqual(conciseContainerDescription(passedOnly, "en"), "");
    assert.strictEqual(
      conciseContainerDescription({ passed: 0, failed: 0, skipped: 2, withResults: 2 }, "en"),
      "",
    );
  });

  it("shows a short failure and refuses a long one", () => {
    assert.strictEqual(
      conciseLeafDescription({
        outcome: "failed",
        errorSnippet: "Expected true",
        locale: "en",
        durationMs: 2300,
      }),
      "Expected true",
    );

    const long = "No matching step definition found for the step in this scenario outline row";
    assert.ok(long.length > 42);
    assert.strictEqual(
      conciseLeafDescription({
        outcome: "failed",
        errorSnippet: long,
        locale: "en",
        durationMs: 40,
      }),
      "failed",
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "failed", errorSnippet: long, locale: "es" }),
      "fallido",
    );
  });

  it("hides absent, invalid, and zero durations on a passed row", () => {
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en" }),
      undefined,
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en", durationMs: 0 }),
      undefined,
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en", durationMs: Number.NaN }),
      undefined,
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en", durationMs: -5 }),
      undefined,
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en", durationMs: 0.4 }),
      undefined,
    );
  });

  it("shows one positive duration and nothing else on a passed row", () => {
    assert.strictEqual(
      conciseLeafDescription({ outcome: "passed", locale: "en", durationMs: 15 }),
      "15 ms",
    );
    assert.strictEqual(
      conciseLeafDescription({
        outcome: "passed",
        locale: "en",
        durationMs: 2300,
        durationDisplay: "seconds",
      }),
      "2.3 s",
    );
  });

  it("uses a short status when the failure text is not a reliable summary", () => {
    assert.strictEqual(
      conciseLeafDescription({
        outcome: "failed",
        skipReason: "not_in_trx",
        locale: "en",
      }),
      "not in results",
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "failed", locale: "en" }),
      "failed",
    );
    assert.strictEqual(
      conciseLeafDescription({ outcome: "skipped", locale: "en" }),
      "skipped",
    );
    assert.strictEqual(
      conciseLeafDescription({ locale: "en", showPendingHint: true }),
      "not run",
    );
  });
});
