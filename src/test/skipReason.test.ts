import * as assert from "assert";
import { describe, it } from "node:test";
import {
  appendSkipReasonToDescription,
  skipReasonLabelForTreeOutcome,
  skipReasonMessage,
} from "../core/results/skipReason";
import { resolveCanceledLeafOutcome } from "../core/results/testRunApply";

describe("skipReason", () => {
  it("localizes skip reasons EN/ES", () => {
    assert.strictEqual(skipReasonMessage("canceled", "en"), "canceled before completion");
    assert.strictEqual(skipReasonMessage("not_in_trx", "es"), "sin resultado");
  });

  it("skipReasonLabelForTreeOutcome maps skipped and unknown", () => {
    assert.strictEqual(skipReasonLabelForTreeOutcome("skipped", "en"), "skipped by runner");
    assert.strictEqual(skipReasonLabelForTreeOutcome("unknown", "es"), "resultado desconocido");
    assert.strictEqual(skipReasonLabelForTreeOutcome("passed", "en"), undefined);
  });

  it("appends skip reason to description", () => {
    assert.strictEqual(
      appendSkipReasonToDescription("passed · 120 ms", "canceled", "en"),
      "passed · 120 ms · canceled before completion",
    );
  });
});

describe("resolveCanceledLeafOutcome", () => {
  it("preserves passed/failed from store on cancel", () => {
    assert.strictEqual(resolveCanceledLeafOutcome("passed"), "passed");
    assert.strictEqual(resolveCanceledLeafOutcome("failed"), "failed");
    assert.strictEqual(resolveCanceledLeafOutcome(undefined), "pending");
  });
});
