import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import { MODE_PROFILES } from "../core/config/types";
import { buildArgs } from "../core/runner/dotnetTest";
import { buildListTestsArgs } from "../core/runner/listTests";
import { readTestRunner, resolveTestRunner } from "../core/runner/testRunner";

const base = {
  dotnetPath: "dotnet",
  projectDir: "/proj/mtp",
  stage: "test" as const,
  mode: MODE_PROFILES.parallel,
  resultsDir: "TestResults",
  trxFileName: "run.trx",
  runner: "mtp" as const,
};

describe("resolveTestRunner", () => {
  const globalJson = JSON.stringify({
    test: { runner: "Microsoft.Testing.Platform" },
  });

  it("uses global.json when the environment variable is absent", () => {
    assert.strictEqual(resolveTestRunner({ globalJsonText: globalJson }), "mtp");
  });

  it("stays on VSTest when global.json is missing, invalid, or names another runner", () => {
    assert.strictEqual(resolveTestRunner({}), "vstest");
    assert.strictEqual(resolveTestRunner({ globalJsonText: "{" }), "vstest");
    assert.strictEqual(
      resolveTestRunner({ globalJsonText: JSON.stringify({ test: { runner: "VSTest" } }) }),
      "vstest",
    );
  });

  it("lets DOTNET_TEST_RUNNER win, ignoring case, including over global.json", () => {
    assert.strictEqual(
      resolveTestRunner({ globalJsonText: globalJson, envValue: "microsoft.testing.platform" }),
      "mtp",
    );
    assert.strictEqual(
      resolveTestRunner({ globalJsonText: globalJson, envValue: "VSTest" }),
      "vstest",
    );
  });

  it("treats an empty or unknown environment value as VSTest", () => {
    assert.strictEqual(resolveTestRunner({ globalJsonText: globalJson, envValue: "" }), "vstest");
    assert.strictEqual(resolveTestRunner({ globalJsonText: globalJson, envValue: "   " }), "vstest");
    assert.strictEqual(resolveTestRunner({ envValue: "other" }), "vstest");
  });
});

describe("readTestRunner", () => {
  it("reads global.json from the project directory, and the environment wins", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-mtp-"));
    fs.writeFileSync(
      path.join(dir, "global.json"),
      JSON.stringify({ test: { runner: "Microsoft.Testing.Platform" } }),
    );
    try {
      assert.strictEqual(readTestRunner(dir, {}), "mtp");
      assert.strictEqual(readTestRunner(dir, { DOTNET_TEST_RUNNER: "" }), "vstest");
      assert.strictEqual(
        readTestRunner(dir, { DOTNET_TEST_RUNNER: "Microsoft.Testing.Platform" }),
        "mtp",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("MTP buildArgs", () => {
  it("requests a TRX with the MTP report flags and no VSTest logger or RunSettings", () => {
    const args = buildArgs({
      ...base,
      testTarget: "MtpBdd.csproj",
      configuration: "Debug",
      noBuild: true,
      cliVerbosity: "minimal",
      settingsPath: "/proj/t.runsettings",
      blame: true,
      blameHang: true,
      filter: "Category=smoke",
    });
    assert.deepStrictEqual(args, [
      "test",
      "MtpBdd.csproj",
      "--configuration",
      "Debug",
      "--no-build",
      "--verbosity",
      "minimal",
      "--results-directory",
      "TestResults",
      "--report-trx",
      "--report-trx-filename",
      "run.trx",
      "--output",
      "Detailed",
      "--filter-trait",
      "Category=smoke",
    ]);
    assert.ok(!args.includes("--logger"));
    assert.ok(!args.includes("--filter"));
    assert.ok(!args.includes("--"));
    assert.ok(!args.some((arg) => arg.startsWith("xUnit.")));
    assert.ok(!args.includes("--settings"));
    assert.ok(!args.includes("--blame"));
  });

  it("selects a feature class, a scenario method, and one outline row", () => {
    const feature = buildArgs({ ...base, filter: "FullyQualifiedName~SmokeFeature" });
    assert.ok(feature.includes("--filter-class"));
    assert.strictEqual(feature[feature.indexOf("--filter-class") + 1], "*SmokeFeature*");

    const scenario = buildArgs({
      ...base,
      filter: "FullyQualifiedName~SmokeFeature.SystemIsReady",
    });
    assert.strictEqual(
      scenario[scenario.indexOf("--filter-method") + 1],
      "*SmokeFeature.SystemIsReady*",
    );

    const row = buildArgs({
      ...base,
      filter: 'DisplayName~first: %221%22, second: %222%22, result: %223%22',
    });
    assert.strictEqual(
      row[row.indexOf("--filter-display-name") + 1],
      '*first: "1", second: "2", result: "3"*',
    );
  });

  it("OR-s two classes with repeated --filter-class and mixed kinds with --filter-query", () => {
    const classes = buildArgs({
      ...base,
      filter: "FullyQualifiedName~SmokeFeature|FullyQualifiedName~E_CommerceFeature",
    });
    assert.deepStrictEqual(
      classes.filter((arg) => arg === "--filter-class" || arg.startsWith("*")),
      ["--filter-class", "*SmokeFeature*", "--filter-class", "*E_CommerceFeature*"],
    );

    const mixed = buildArgs({
      ...base,
      filter: "Category=smoke|FullyQualifiedName~GreetingsFeature",
    });
    assert.ok(!mixed.includes("--filter"));
    assert.ok(mixed.includes("--filter-query"));
    assert.ok(mixed.includes("/[Category=smoke]"));
    assert.ok(mixed.includes("/*/*/*GreetingsFeature*"));
  });

  it("does not combine a display-name filter with a query filter", () => {
    const args = buildArgs({
      ...base,
      filter:
        'DisplayName~first: %221%22, second: %222%22, result: %223%22|FullyQualifiedName~GreetingsFeature',
    });
    assert.ok(!args.includes("--filter-display-name"));
    assert.ok(args.includes("/*/*/*GreetingsFeature*"));
    assert.ok(!args.includes("--filter"));
  });

  it("keeps the same MTP argv for debug, parallel, and ci modes", () => {
    const debug = buildArgs({ ...base, mode: MODE_PROFILES.debug }, { includeXUnitRunSettings: false });
    const parallel = buildArgs({ ...base, mode: MODE_PROFILES.parallel });
    const ci = buildArgs({ ...base, mode: MODE_PROFILES.ci });
    assert.deepStrictEqual(debug, parallel);
    assert.deepStrictEqual(parallel, ci);
  });
});

describe("MTP list-tests", () => {
  it("does not send --list-tests, so the listed=0 probe is not a false block", () => {
    const args = buildListTestsArgs({
      dotnetPath: "dotnet",
      projectDir: "/proj/mtp",
      testTarget: "MtpBdd.csproj",
      filter: "Category=smoke",
      runner: "mtp",
    });
    assert.deepStrictEqual(args, ["test"]);
    assert.ok(!args.includes("--list-tests"));
    assert.ok(!args.includes("--filter"));
  });
});
