import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { after, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../core/config/types";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import {
  buildArgs,
  resolveTrxPath,
  RunCallbacks,
  RunRequest as DotnetRunRequest,
  RunResult,
} from "../core/runner/dotnetTest";
import { executeTestRun, ExecuteTestRunInput, RunDotnetTestFn } from "../core/runner/executeTestRun";
import { RunTarget } from "../core/runner/filterBuilder";

const tempDirs: string[] = [];

after(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-exec-"));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, "config"), { recursive: true });
  return dir;
}

function feature(projectDir: string): FeatureInfo {
  return {
    name: "Orders",
    filePath: path.join(projectDir, "Features", "Orders.feature"),
    tags: [],
    scenarios: [],
  };
}

function placeOrder(): ScenarioInfo {
  return { name: "Place order", tags: [], line: 12, isOutline: false };
}

function addItem(): ScenarioInfo {
  return { name: "Add item", tags: [], line: 8, isOutline: true };
}

function widgetRow(): OutlineExample {
  return {
    rowIndex: 1,
    line: 15,
    headers: ["sku"],
    values: ["widget"],
    label: "sku=widget",
  };
}

function scenarioTarget(projectDir: string): RunTarget {
  return { kind: "scenario", feature: feature(projectDir), scenario: placeOrder() };
}

function trxDocument(resultsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    ${resultsXml}
  </Results>
</TestRun>`;
}

function unitResult(input: {
  testName: string;
  outcome: "Passed" | "Failed";
  duration?: string;
  message?: string;
}): string {
  const duration = input.duration ? ` duration="${input.duration}"` : "";
  const body = input.message
    ? `<Output><ErrorInfo><Message>${input.message}</Message></ErrorInfo></Output>`
    : "";
  return `<UnitTestResult testName="${input.testName}" outcome="${input.outcome}"${duration}>${body}</UnitTestResult>`;
}

interface ScriptedRun {
  mode: "complete" | "abort-before" | "abort-during" | "abort-during-with-trx";
  exitCode?: number | null;
  forced?: boolean;
  stdout?: string;
  stderr?: string;
  trxXml?: string;
  seenSignal?: AbortSignal;
  seenFilter?: string;
  seenExtraEnv?: Record<string, string>;
  seenArgs?: string[];
}

function scriptedRun(script: ScriptedRun): RunDotnetTestFn {
  return (req: DotnetRunRequest, callbacks: RunCallbacks, signal: AbortSignal): Promise<RunResult> => {
    script.seenSignal = signal;
    script.seenFilter = req.filter;
    script.seenExtraEnv = req.extraEnv;
    const args = buildArgs(req);
    script.seenArgs = args;
    callbacks.onStart?.(`${req.dotnetPath} ${args.join(" ")}`);
    const trxPath = resolveTrxPath(req);

    if (script.mode === "abort-before") {
      return Promise.resolve({
        exitCode: null,
        canceled: true,
        forced: script.forced,
        trxPath,
      });
    }

    if (script.stdout) {
      callbacks.onStdout?.(script.stdout);
    }
    if (script.stderr) {
      callbacks.onStderr?.(script.stderr);
    }

    const canceled = script.mode === "abort-during" || script.mode === "abort-during-with-trx";
    if (script.trxXml && (script.mode === "complete" || script.mode === "abort-during-with-trx")) {
      fs.mkdirSync(path.dirname(trxPath), { recursive: true });
      fs.writeFileSync(trxPath, script.trxXml, "utf8");
    }

    return Promise.resolve({
      exitCode: script.exitCode ?? (canceled ? null : 0),
      canceled,
      forced: script.forced,
      trxPath,
    });
  };
}

function input(
  projectDir: string,
  targets: RunTarget[],
  run: RunDotnetTestFn,
  overrides: Partial<ExecuteTestRunInput> = {},
): ExecuteTestRunInput {
  return {
    targets,
    stage: "test",
    mode: "parallel",
    settings: { ...DEFAULT_SETTINGS },
    projectDir,
    totalExpected: 1,
    runDotnetTest: run,
    ...overrides,
  };
}

describe("executeTestRun", () => {
  it("returns a matched structured result for a successful run", async () => {
    const projectDir = createProject();
    const envSecret = "env-only-secret";
    fs.writeFileSync(
      path.join(projectDir, "config", ".env.test"),
      `CLIENT_SECRET=${envSecret}\n`,
      "utf8",
    );
    const script: ScriptedRun = {
      mode: "complete",
      stdout: "password=stdout-secret\n",
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Passed",
          duration: "00:00:01.2500000",
        }),
      ),
    };
    let started = false;
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script), {
        onRunStarted: () => {
          started = true;
        },
      }),
    );

    assert.strictEqual(started, true);
    assert.strictEqual(script.seenFilter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.ok(script.seenArgs?.includes("--filter"));
    assert.ok(script.seenArgs?.includes("FullyQualifiedName~OrdersFeature.PlaceOrder"));
    assert.strictEqual(script.seenExtraEnv?.CLIENT_SECRET, envSecret);
    assert.strictEqual(result.filter, script.seenFilter);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.canceled, false);
    assert.strictEqual(result.summary?.passed, 1);
    assert.strictEqual(result.summary?.source, "trx");
    assert.strictEqual(result.matchedScenarios.length, 1);
    assert.strictEqual(result.matchedScenarios[0].scenarioName, "Place order");
    assert.strictEqual(result.matchedScenarios[0].scenarioLine, 12);
    assert.strictEqual(result.matchedScenarios[0].outcome, "passed");
    assert.strictEqual(result.matchedScenarios[0].durationMs, 1250);
    assert.ok(result.outputBuffer.includes("password=***REDACTED***"));
    assert.ok(!result.outputBuffer.includes("stdout-secret"));
    assert.ok(!result.outputBuffer.includes(envSecret));
    assert.ok(result.outputBuffer.includes("--filter"));
  });

  it("keeps outcome, duration, and the raw internal error on a failed run", async () => {
    const projectDir = createProject();
    const raw = "Expected 401 but got 200. CLIENT_SECRET=core-raw-secret";
    const script: ScriptedRun = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: raw,
        }),
      ),
    };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.summary?.failed, 1);
    assert.strictEqual(result.summary?.results[0].errorMessage, raw);
    assert.strictEqual(result.matchedScenarios.length, 1);
    assert.strictEqual(result.matchedScenarios[0].outcome, "failed");
    assert.strictEqual(result.matchedScenarios[0].durationMs, 500);
    assert.strictEqual(result.matchedScenarios[0].errorMessage, raw);
  });

  it("returns cancellation with no summary when the run aborts before results", async () => {
    const projectDir = createProject();
    const script: ScriptedRun = { mode: "abort-before", forced: true };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.forced, true);
    assert.strictEqual(result.exitCode, null);
    assert.strictEqual(result.summary, undefined);
    assert.deepStrictEqual(result.matchedScenarios, []);
    assert.strictEqual(result.liveState.completed, 0);
    assert.ok(result.outputBuffer.includes("[bdd-pilot]"));
    assert.ok(!result.outputBuffer.includes("Run canceled"));
  });

  it("returns live counts and empty matches when cancel has progress but no TRX", async () => {
    const projectDir = createProject();
    const script: ScriptedRun = {
      mode: "abort-during",
      stdout: "[xUnit.net 00:00:01.00] Passed OrdersFeature.PlaceOrder [10 ms]\n",
    };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.summary, undefined);
    assert.deepStrictEqual(result.matchedScenarios, []);
    assert.strictEqual(result.liveState.passed, 1);
    assert.strictEqual(result.liveState.completed, 1);
    assert.strictEqual(result.liveState.failed, 0);
  });

  it("returns both live progress and TRX so the caller can prefer TRX on cancel", async () => {
    const projectDir = createProject();
    const script: ScriptedRun = {
      mode: "abort-during-with-trx",
      stdout: "[xUnit.net 00:00:01.00] Passed OrdersFeature.PlaceOrder [10 ms]\n",
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: "Expected status",
        }),
      ),
    };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.liveState.passed, 1);
    assert.strictEqual(result.summary?.failed, 1);
    assert.strictEqual(result.summary?.results[0].durationMs, 500);
    assert.strictEqual(result.matchedScenarios[0].outcome, "failed");
    assert.strictEqual(result.matchedScenarios[0].durationMs, 500);
  });

  it("falls back to unmatched rows when no result matches a target", async () => {
    const projectDir = createProject();
    const script: ScriptedRun = {
      mode: "complete",
      trxXml: trxDocument(
        unitResult({
          testName: "HelperTests.TotallyDifferent",
          outcome: "Failed",
          message: "CLIENT_SECRET=unmatched-raw-secret",
        }),
      ),
    };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.summary?.results.length, 1);
    assert.strictEqual(result.summary?.results[0].errorMessage, "CLIENT_SECRET=unmatched-raw-secret");
    assert.strictEqual(result.matchedScenarios.length, 1);
    assert.strictEqual(result.matchedScenarios[0].featurePath, "");
    assert.strictEqual(result.matchedScenarios[0].scenarioLine, 0);
    assert.strictEqual(result.matchedScenarios[0].scenarioName, "HelperTests.TotallyDifferent");
    assert.strictEqual(result.matchedScenarios[0].errorMessage, "CLIENT_SECRET=unmatched-raw-secret");
  });

  it("keeps only matched rows when at least one result matches", async () => {
    const projectDir = createProject();
    const script: ScriptedRun = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        [
          unitResult({
            testName: "OrdersFeature.PlaceOrder",
            outcome: "Failed",
            message: "assertion failed",
          }),
          unitResult({
            testName: "HelperTests.TotallyDifferent",
            outcome: "Failed",
            message: "CLIENT_SECRET=other-raw-secret",
          }),
        ].join(""),
      ),
    };
    const result = await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script)),
    );

    assert.strictEqual(result.summary?.results.length, 2);
    assert.strictEqual(result.summary?.results[1].errorMessage, "CLIENT_SECRET=other-raw-secret");
    assert.strictEqual(result.matchedScenarios.length, 1);
    assert.strictEqual(result.matchedScenarios[0].scenarioName, "Place order");
    assert.strictEqual(result.matchedScenarios[0].errorMessage, "assertion failed");
  });

  it("sends the outline row filter and matches the parent scenario", async () => {
    const projectDir = createProject();
    const target: RunTarget = {
      kind: "outlineRow",
      feature: feature(projectDir),
      scenario: addItem(),
      example: widgetRow(),
    };
    const script: ScriptedRun = {
      mode: "complete",
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.AddItem(widget)",
          outcome: "Passed",
        }),
      ),
    };
    const result = await executeTestRun(input(projectDir, [target], scriptedRun(script)));

    assert.strictEqual(script.seenFilter, 'DisplayName~sku: %22widget%22');
    assert.strictEqual(result.matchedScenarios.length, 1);
    assert.strictEqual(result.matchedScenarios[0].scenarioLine, 8);
    assert.strictEqual(result.matchedScenarios[0].scenarioName, "Add item");
    assert.ok(!result.matchedScenarios[0].scenarioName.includes("row"));
  });

  it("forwards the caller AbortSignal to the runner", async () => {
    const projectDir = createProject();
    const controller = new AbortController();
    controller.abort();
    const script: ScriptedRun = { mode: "abort-before", forced: true };
    await executeTestRun(
      input(projectDir, [scenarioTarget(projectDir)], scriptedRun(script), {
        signal: controller.signal,
      }),
    );

    assert.strictEqual(script.seenSignal, controller.signal);
    assert.strictEqual(script.seenSignal?.aborted, true);
  });
});
