import * as assert from "assert";
import { describe, it } from "node:test";
import {
  formatRunSettingsMissingMessage,
  resolveRunSettingsPath,
} from "../core/runner/runSettingsPath";

describe("resolveRunSettingsPath", () => {
  it("returns empty when configured path is blank", () => {
    assert.deepStrictEqual(resolveRunSettingsPath("/ws", "", () => true), {});
    assert.deepStrictEqual(resolveRunSettingsPath("/ws", "   ", () => true), {});
  });

  it("resolves relative path against workspace root when file exists", () => {
    const exists = (p: string) => p === "/ws/config/test.runsettings";
    const result = resolveRunSettingsPath("/ws", "config/test.runsettings", exists);
    assert.strictEqual(result.settingsPath, "/ws/config/test.runsettings");
  });

  it("uses absolute path when it exists", () => {
    const abs = "/absolute/test.runsettings";
    const result = resolveRunSettingsPath("/ws", abs, (p) => p === abs);
    assert.strictEqual(result.settingsPath, abs);
  });

  it("returns missingPath when file does not exist", () => {
    const result = resolveRunSettingsPath("/ws", "missing.runsettings", () => false);
    assert.strictEqual(result.missingPath, "/ws/missing.runsettings");
    assert.strictEqual(result.settingsPath, undefined);
  });

  it("checks relative path as-is when workspace root is missing", () => {
    const result = resolveRunSettingsPath(undefined, "local.runsettings", () => false);
    assert.strictEqual(result.missingPath, "local.runsettings");
  });
});

describe("formatRunSettingsMissingMessage", () => {
  it("prefixes bdd-pilot tag", () => {
    assert.match(formatRunSettingsMissingMessage("/x.runsettings"), /^\[bdd-pilot\] Run settings file not found:/);
  });
});
