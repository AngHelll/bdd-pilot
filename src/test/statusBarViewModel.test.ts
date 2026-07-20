import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  formatCompactStatusBarLabel,
  formatCompactStatusBarTooltip,
  formatDetailedStageTooltip,
  readStatusBarDisplayMode,
  statusBarNeedsWarning,
  truncateStatusBarProjectLabel,
} from "../core/config/statusBarViewModel";

describe("statusBarViewModel", () => {
  it("readStatusBarDisplayMode defaults to compact", () => {
    assert.strictEqual(readStatusBarDisplayMode(undefined), "compact");
    assert.strictEqual(readStatusBarDisplayMode("compact"), "compact");
    assert.strictEqual(readStatusBarDisplayMode("detailed"), "detailed");
    assert.strictEqual(readStatusBarDisplayMode("unknown"), "compact");
  });

  it("truncateStatusBarProjectLabel shortens long labels", () => {
    const long = "MyVeryLongTestProjectName.Tests";
    const truncated = truncateStatusBarProjectLabel(long, 20);
    assert.strictEqual(truncated.length, 20);
    assert.ok(truncated.endsWith("…"));
  });

  it("statusBarNeedsWarning for stg/prod and missing project", () => {
    assert.strictEqual(statusBarNeedsWarning("test", "App.Tests"), false);
    assert.strictEqual(statusBarNeedsWarning("stg", "App.Tests"), true);
    assert.strictEqual(statusBarNeedsWarning("prod", "App.Tests"), true);
    assert.strictEqual(statusBarNeedsWarning("test", undefined), true);
  });

  it("formatCompactStatusBarLabel includes brand, segments = mode · project", () => {
    const label = formatCompactStatusBarLabel({
      stage: "test",
      mode: "parallel",
      locale: "en",
      projectLabel: "MinimalBdd.Tests",
    });
    assert.strictEqual(label, "$(beaker) Pilot  test · parallel · MinimalBdd.Tests");
  });

  it("formatCompactStatusBarLabel omits spinner when running", () => {
    const label = formatCompactStatusBarLabel({
      stage: "dev",
      mode: "debug",
      locale: "en",
      projectLabel: "App.Tests",
      running: true,
    });
    assert.strictEqual(label, "$(beaker) Pilot  dev · debug · App.Tests");
    assert.ok(!label.includes("loading~spin"));
  });

  it("formatCompactStatusBarTooltip includes sections and action hint", () => {
    const tooltip = formatCompactStatusBarTooltip({
      stage: "test",
      mode: "ci",
      locale: "en",
      projectLabel: "App.sln",
      solutionSelected: true,
    });
    assert.ok(tooltip.includes("BDD Pilot — execution settings"));
    assert.ok(tooltip.includes("Environment (STAGE): test"));
    assert.ok(tooltip.includes("slower"));
    assert.ok(tooltip.includes("Click to change settings"));
  });

  it("formatCompactStatusBarTooltip includes env files when present", () => {
    const tooltip = formatCompactStatusBarTooltip({
      stage: "test",
      mode: "parallel",
      locale: "en",
      projectLabel: "App.Tests",
      envStatus: { existingBasenames: [".env.test", ".env.test.local"] },
    });
    assert.ok(tooltip.includes("Env files: .env.test, .env.test.local"));
  });

  it("formatCompactStatusBarTooltip includes run flags when present", () => {
    const tooltip = formatCompactStatusBarTooltip({
      stage: "stg",
      mode: "parallel",
      locale: "en",
      projectLabel: "App.Tests",
      runFlagsSummary: "Release · stg.runsettings",
    });
    assert.ok(tooltip.includes("Run flags: Release · stg.runsettings"));
  });

  it("formatCompactStatusBarTooltip shows optional missing env line", () => {
    const tooltip = formatCompactStatusBarTooltip({
      stage: "stg",
      mode: "parallel",
      locale: "en",
      projectLabel: "App.Tests",
      envStatus: { existingBasenames: [] },
    });
    assert.ok(tooltip.includes("Env: no file for this stage (optional)"));
  });

  it("formatCompactStatusBarTooltip omits env line without project context", () => {
    const tooltip = formatCompactStatusBarTooltip({
      stage: "test",
      mode: "parallel",
      locale: "en",
      projectLabel: "App.Tests",
    });
    assert.ok(!tooltip.includes("Env files:"));
    assert.ok(!tooltip.includes("Env: no file"));
  });

  it("formatDetailedStageTooltip includes env line on stage item", () => {
    const tooltip = formatDetailedStageTooltip("en", {
      existingBasenames: [".env.test"],
    });
    assert.ok(tooltip.includes("select environment"));
    assert.ok(tooltip.includes("Env files: .env.test"));
  });
});
