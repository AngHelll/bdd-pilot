import * as assert from "assert";
import { describe, it } from "node:test";
import {
  detectBuildFileLock,
  formatBuildFileLockHintLine,
} from "../core/runner/buildFileLockHint";

describe("detectBuildFileLock", () => {
  it("matches MSB3021", () => {
    assert.strictEqual(
      detectBuildFileLock("error MSB3021: Unable to copy file"),
      true,
    );
  });

  it("matches file-in-use phrasing", () => {
    assert.strictEqual(
      detectBuildFileLock("The process cannot access the file because it is being used by another process."),
      true,
    );
  });

  it("ignores unrelated output", () => {
    assert.strictEqual(detectBuildFileLock("Passed!  - Failed: 0"), false);
  });
});

describe("formatBuildFileLockHintLine", () => {
  it("returns a stable Output hint", () => {
    assert.strictEqual(
      formatBuildFileLockHintLine(),
      "[bdd-pilot] Build/file lock detected — Cancel or wait for terminal build.",
    );
  });
});
