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
});
