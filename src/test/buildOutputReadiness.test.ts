import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  assessBuildOutputs,
  classifyUnlockOutputRecheck,
  shouldBlockForMissingOutputs,
} from "../core/runner/buildOutputReadiness";

function tempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pilot-outputs-"));
}

describe("assessBuildOutputs", () => {
  it("is missing when bin/ does not exist", () => {
    const dir = tempProject();
    assert.strictEqual(assessBuildOutputs(dir), "missing");
  });

  it("is missing when bin/ has no dll", () => {
    const dir = tempProject();
    fs.mkdirSync(path.join(dir, "bin", "Debug"), { recursive: true });
    fs.writeFileSync(path.join(dir, "bin", "Debug", "note.txt"), "x");
    assert.strictEqual(assessBuildOutputs(dir), "missing");
  });

  it("is present when any dll exists under bin/, even if obj/ is gone", () => {
    const dir = tempProject();
    const dll = path.join(dir, "bin", "Debug", "net8.0", "App.dll");
    fs.mkdirSync(path.dirname(dll), { recursive: true });
    fs.writeFileSync(dll, "");
    assert.strictEqual(assessBuildOutputs(dir), "present");
  });
});

describe("shouldBlockForMissingOutputs", () => {
  it("blocks only a csproj with no-build and missing outputs", () => {
    assert.strictEqual(
      shouldBlockForMissingOutputs({
        noBuild: true,
        testTarget: "/repo/App.csproj",
        assessment: "missing",
      }),
      true,
    );
    assert.strictEqual(
      shouldBlockForMissingOutputs({
        noBuild: false,
        testTarget: "/repo/App.csproj",
        assessment: "missing",
      }),
      false,
    );
    assert.strictEqual(
      shouldBlockForMissingOutputs({
        noBuild: true,
        testTarget: "/repo/App.sln",
        assessment: "missing",
      }),
      false,
    );
    assert.strictEqual(
      shouldBlockForMissingOutputs({
        noBuild: true,
        testTarget: "/repo/App.csproj",
        assessment: "present",
      }),
      false,
    );
  });
});

describe("classifyUnlockOutputRecheck", () => {
  it("does not invent a removed notice when outputs were already missing", () => {
    assert.deepStrictEqual(
      classifyUnlockOutputRecheck({
        assessment: "missing",
        removedActiveBeforeLock: false,
        assessmentBeforeLock: "missing",
      }),
      { invalidateTheoryCache: false, removed: false },
    );
  });

  it("invalidates when a run ends and the removed notice was already up", () => {
    assert.deepStrictEqual(
      classifyUnlockOutputRecheck({
        assessment: "present",
        removedActiveBeforeLock: true,
        assessmentBeforeLock: "missing",
      }),
      { invalidateTheoryCache: true, removed: false },
    );
  });

  it("does not invalidate a normal run that finishes with outputs present", () => {
    assert.deepStrictEqual(
      classifyUnlockOutputRecheck({
        assessment: "present",
        removedActiveBeforeLock: false,
        assessmentBeforeLock: "present",
      }),
      { invalidateTheoryCache: false, removed: false },
    );
  });

  it("raises the notice when outputs disappear during the lock", () => {
    assert.deepStrictEqual(
      classifyUnlockOutputRecheck({
        assessment: "missing",
        removedActiveBeforeLock: false,
        assessmentBeforeLock: "present",
      }),
      { invalidateTheoryCache: true, removed: true },
    );
  });
});
