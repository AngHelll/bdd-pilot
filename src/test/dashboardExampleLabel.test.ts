import * as assert from "assert";
import { describe, it } from "node:test";
import {
  DASHBOARD_EXAMPLE_LABEL_MAX,
  formatDashboardScenarioLabel,
} from "../core/results/dashboardExampleLabel";
import { scenarioHistoryKey } from "../core/results/runHistory";

describe("dashboardExampleLabel", () => {
  it("reuses the tree example label and drops exampleTags", () => {
    const stored =
      'Add two numbers(first: "5", second: "7", result: "12", exampleTags: [])';
    const visible = formatDashboardScenarioLabel(stored);
    assert.strictEqual(visible.title, "Add two numbers · first=5, second=7 +1");
    assert.strictEqual(visible.label, visible.title);
    assert.doesNotMatch(visible.label, /exampleTags/);
    assert.notStrictEqual(visible.title, stored);
  });

  it("keeps a plain scenario name and does not rewrite the history key", () => {
    const stored = "Guest pays";
    const key = scenarioHistoryKey("/tmp/pay.feature", 4, stored);
    const visible = formatDashboardScenarioLabel(stored);
    assert.strictEqual(visible.label, "Guest pays");
    assert.strictEqual(visible.title, "Guest pays");
    assert.strictEqual(scenarioHistoryKey("/tmp/pay.feature", 4, stored), key);
  });

  it("shortens a runner method name and truncates only the visible label", () => {
    const stored =
      'Ns.AlphaFeature.PaintTheTile(color: "red", __pickleIndex: 2, exampleTags: [])';
    const visible = formatDashboardScenarioLabel(stored);
    assert.strictEqual(visible.title, "PaintTheTile · color=red");
    assert.doesNotMatch(visible.title, /exampleTags|__pickleIndex/);

    const long = `${"Very long scenario name ".repeat(6)}(name: "x", exampleTags: [])`;
    const truncated = formatDashboardScenarioLabel(long);
    assert.ok(truncated.title.length > DASHBOARD_EXAMPLE_LABEL_MAX);
    assert.strictEqual(truncated.label.length, DASHBOARD_EXAMPLE_LABEL_MAX);
    assert.ok(truncated.label.endsWith("…"));
    assert.ok(truncated.title.startsWith("Very long scenario name"));
    assert.doesNotMatch(truncated.label, /exampleTags/);
  });
});
