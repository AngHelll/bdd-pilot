import * as assert from "assert";
import { describe, it } from "node:test";
import { formatDuration, formatDurationTooltip } from "../core/results/durationFormat";

describe("durationFormat", () => {
  it("auto uses ms for sub-second runs", () => {
    assert.strictEqual(formatDuration(450, "auto"), "450 ms");
  });

  it("auto uses seconds with one decimal under 10s", () => {
    assert.strictEqual(formatDuration(2341, "auto"), "2.3 s");
  });

  it("auto uses whole or one-decimal seconds under a minute", () => {
    assert.strictEqual(formatDuration(12_400, "auto"), "12.4 s");
    assert.strictEqual(formatDuration(45_000, "auto"), "45 s");
  });

  it("auto uses minutes for longer runs", () => {
    assert.strictEqual(formatDuration(135_000, "auto"), "2m 15s");
  });

  it("ms mode always shows milliseconds", () => {
    assert.strictEqual(formatDuration(2341, "ms"), "2341 ms");
  });

  it("compact mode uses short suffixes", () => {
    assert.strictEqual(formatDuration(800, "compact"), "800ms");
    assert.strictEqual(formatDuration(45_000, "compact"), "45s");
    assert.strictEqual(formatDuration(150_000, "compact"), "2m 30s");
  });

  it("tooltip shows human scale plus exact ms", () => {
    assert.strictEqual(formatDurationTooltip(2341), "Duration: 2.3 s (2341 ms)");
    assert.strictEqual(formatDurationTooltip(450), "Duration: 450 ms");
  });
});
