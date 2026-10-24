import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildDashboardHistoryBars,
  renderDashboardHistoryChart,
} from "../core/results/dashboardChart";

describe("dashboardChart", () => {
  it("draws the newest run on the right with pass, fail, then skip", () => {
    const bars = buildDashboardHistoryBars([
      { passed: 2, failed: 2, skipped: 0 },
      { passed: 0, failed: 1, skipped: 0 },
      { passed: 1, failed: 0, skipped: 0 },
    ]);
    assert.strictEqual(bars.length, 3);
    assert.strictEqual(bars[0]?.passed, 1);
    assert.strictEqual(bars[2]?.passed, 2);
    assert.strictEqual(bars[2]?.heightFraction, 1);
    assert.strictEqual(bars[0]?.heightFraction, 0.25);
    assert.deepStrictEqual(
      bars[2]?.segments.map((segment) => segment.kind),
      ["pass", "fail"],
    );
    const mixed = buildDashboardHistoryBars([{ passed: 1, failed: 1, skipped: 1 }]);
    assert.deepStrictEqual(
      mixed[0]?.segments.map((segment) => segment.kind),
      ["pass", "fail", "skip"],
    );
  });

  it("marks a run with no counts instead of hiding it", () => {
    const bars = buildDashboardHistoryBars([
      { passed: 2, failed: 0, skipped: 0 },
      { passed: 0, failed: 0, skipped: 0 },
    ]);
    assert.strictEqual(bars[0]?.heightFraction, 0);
    assert.deepStrictEqual(bars[0]?.segments, []);
    const svg = renderDashboardHistoryChart(bars, "Last 2 runs", () => "counts");
    assert.match(svg, /data-kind="empty"/);
    assert.match(svg, /role="img"/);
    assert.doesNotMatch(svg, /<button/);
  });

  it("renders nothing when there are no bars", () => {
    assert.strictEqual(renderDashboardHistoryChart([], "Last 0 runs", () => ""), "");
  });
});
