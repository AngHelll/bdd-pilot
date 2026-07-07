import * as assert from "assert";
import { describe, it } from "node:test";
import { buildArgs, buildEnv, resolveTrxPath } from "../core/runner/dotnetTest";
import { MODE_PROFILES } from "../core/config/types";

const base = {
  dotnetPath: "dotnet",
  projectDir: "/proj/src/Service.Automation",
  stage: "test" as const,
  mode: MODE_PROFILES.parallel,
  resultsDir: "TestResults",
  trxFileName: "run.trx",
};

describe("dotnet test args", () => {
  it("includes trx logger and results directory", () => {
    const args = buildArgs({ ...base });
    assert.ok(args.includes("--logger"));
    assert.ok(args.includes("trx;LogFileName=run.trx"));
    assert.ok(args.includes("--results-directory"));
    assert.ok(args.includes("TestResults"));
  });

  it("includes filter when provided and omits it otherwise", () => {
    const withFilter = buildArgs({ ...base, filter: "Category=P0" });
    assert.ok(withFilter.includes("--filter"));
    assert.ok(withFilter.includes("Category=P0"));

    const withoutFilter = buildArgs({ ...base });
    assert.ok(!withoutFilter.includes("--filter"));
  });

  it("passes parallelism as RunSettings after --", () => {
    const args = buildArgs({ ...base });
    const sepIdx = args.indexOf("--");
    assert.ok(sepIdx >= 0);
    const after = args.slice(sepIdx + 1).join(" ");
    assert.match(after, /xUnit\.MaxParallelThreads=4/);
    assert.match(after, /xUnit\.ParallelizeTestCollections=true/);
  });

  it("buildEnv injects STAGE without mutating base", () => {
    const env = buildEnv({ EXISTING: "1" }, "stg");
    assert.strictEqual(env.STAGE, "stg");
    assert.strictEqual(env.EXISTING, "1");
  });

  it("resolveTrxPath joins relative results dir with project dir", () => {
    const p = resolveTrxPath({ ...base });
    assert.strictEqual(p, "/proj/src/Service.Automation/TestResults/run.trx");
  });

  it("includes explicit csproj target when provided", () => {
    const args = buildArgs({
      ...base,
      testTarget: "/proj/src/Service.Automation/Tests.csproj",
    });
    assert.strictEqual(args[1], "/proj/src/Service.Automation/Tests.csproj");
  });

  it("includes explicit .slnx target when provided", () => {
    const args = buildArgs({
      ...base,
      testTarget: "/proj/App.slnx",
    });
    assert.strictEqual(args[1], "/proj/App.slnx");
  });

  it("omits directory target (not an explicit file)", () => {
    const args = buildArgs({
      ...base,
      testTarget: "/proj/src",
    });
    assert.notStrictEqual(args[1], "/proj/src");
  });

  it("includes configuration, no-build, and settings in order before trx logger", () => {
    const args = buildArgs({
      ...base,
      configuration: "Release",
      noBuild: true,
      settingsPath: "/proj/test.runsettings",
    });
    const configIdx = args.indexOf("--configuration");
    const noBuildIdx = args.indexOf("--no-build");
    const settingsIdx = args.indexOf("--settings");
    const loggerIdx = args.indexOf("--logger");
    assert.ok(configIdx >= 0 && args[configIdx + 1] === "Release");
    assert.ok(noBuildIdx >= 0);
    assert.ok(settingsIdx >= 0 && args[settingsIdx + 1] === "/proj/test.runsettings");
    assert.ok(configIdx < noBuildIdx && noBuildIdx < settingsIdx && settingsIdx < loggerIdx);
  });

  it("omits run flags when unset", () => {
    const args = buildArgs({ ...base });
    assert.ok(!args.includes("--configuration"));
    assert.ok(!args.includes("--no-build"));
    assert.ok(!args.includes("--settings"));
  });

  it("can omit xUnit RunSettings for debug launches", () => {
    const args = buildArgs({ ...base, filter: "Category=smoke" }, { includeXUnitRunSettings: false });
    assert.ok(!args.includes("--"));
    assert.ok(!args.some((a) => a.startsWith("xUnit.")));
    assert.ok(args.includes("--filter"));
  });
});
