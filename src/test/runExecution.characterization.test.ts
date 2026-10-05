import * as assert from "assert";
import * as fs from "fs";
import { createRequire } from "module";
import * as os from "os";
import * as path from "path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "../core/config/types";
import {
  readLastFailureArtifact,
  resolveLastFailureLogPath,
} from "../core/diagnostics/lastFailureArtifact";
import { formatRunTargetScopeLabels } from "../core/diagnostics/aiFailureContext";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import { RunHistoryEntry, scenarioHistoryKey } from "../core/results/runHistory";
import { RunTarget } from "../core/runner/filterBuilder";
import { outlineRowKey } from "../core/runner/runScope";
import type { RunCallbacks, RunRequest as DotnetRunRequest, RunResult } from "../core/runner/dotnetTest";
import { mapHistoryEntry, mapLastRun } from "../api/pilotRunApiMapper";
import { parseTrx } from "../core/results/trxParser";
import { OutcomeStore } from "../providers/outcomeStore";
import type { RunRequest, RunService } from "../providers/runService";

/**
 * Characterization of the current `RunService.runExecution` orchestration.
 *
 * The VS Code extension host and `dotnet test` are replaced in this process only.
 * Production modules are not patched on disk.
 */

const nodeRequire = createRequire(__filename);
const STDOUT_SECRET = "stdout-secret-value";
const STDERR_SECRET = "stderr-secret-value";
const ENV_SECRET = "env-only-secret-value";
const TRX_SECRET = "trx-error-secret";

type RunServiceCtor = new (loadPersisted?: () => RunHistoryEntry[]) => RunService;

type ScriptMode = "complete" | "abort-before" | "abort-during" | "abort-during-with-trx";

interface Script {
  mode: ScriptMode;
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  forced?: boolean;
  trxXml?: string;
}

interface DotnetTestExports {
  runDotnetTest: (
    req: DotnetRunRequest,
    callbacks: RunCallbacks,
    signal: AbortSignal,
  ) => Promise<RunResult>;
  buildArgs: (req: DotnetRunRequest) => string[];
  resolveTrxPath: (req: DotnetRunRequest) => string;
  __bddPilotRunShim?: boolean;
}

interface RequireFn {
  (this: unknown, id: string): unknown;
}

interface NodeModuleWithRequire {
  prototype: { require: RequireFn };
}

class TestEventEmitter<T> {
  private readonly listeners = new Set<(value: T) => void>();

  readonly event = (listener: (value: T) => void): { dispose: () => void } => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  };

  fire(value: T): void {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

const vscodeMock = {
  EventEmitter: TestEventEmitter,
  workspace: { workspaceFolders: undefined },
  window: {
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showInformationMessage: async () => undefined,
  },
  debug: { startDebugging: async () => false },
  extensions: { getExtension: () => undefined },
  TestMessage: class TestMessage {
    constructor(readonly message: string) {}
  },
  Location: class Location {
    constructor(
      readonly uri: unknown,
      readonly position: unknown,
    ) {}
  },
  Uri: { file: (fsPath: string) => ({ fsPath, path: fsPath }) },
  Position: class Position {
    constructor(
      readonly line: number,
      readonly character: number,
    ) {}
  },
};

let RunServiceCtor: RunServiceCtor | undefined;
let originalRequire: RequireFn | undefined;
let script: Script = { mode: "complete" };
let signalAbortedAtEntry = false;
let lastDotnetFilter: string | undefined;
let lastExtraEnv: Record<string, string> | undefined;
const tempDirs: string[] = [];

function installHost(): void {
  if (originalRequire) {
    return;
  }
  const Module = nodeRequire("module") as NodeModuleWithRequire;
  originalRequire = Module.prototype.require;
  const original = originalRequire;
  Module.prototype.require = function (this: unknown, id: string): unknown {
    if (id === "vscode") {
      return vscodeMock;
    }
    const loaded = original.call(this, id);
    return shimDotnetTest(loaded);
  };
}

function shimDotnetTest(loaded: unknown): unknown {
  if (!loaded || typeof loaded !== "object") {
    return loaded;
  }
  const mod = loaded as DotnetTestExports;
  if (mod.__bddPilotRunShim) {
    return loaded;
  }
  if (
    typeof mod.runDotnetTest !== "function" ||
    typeof mod.buildArgs !== "function" ||
    typeof mod.resolveTrxPath !== "function"
  ) {
    return loaded;
  }
  mod.runDotnetTest = (req, callbacks, signal) => simulateDotnetTest(mod, req, callbacks, signal);
  mod.__bddPilotRunShim = true;
  return loaded;
}

function simulateDotnetTest(
  mod: DotnetTestExports,
  req: DotnetRunRequest,
  callbacks: RunCallbacks,
  signal: AbortSignal,
): Promise<RunResult> {
  signalAbortedAtEntry = signal.aborted;
  lastDotnetFilter = req.filter;
  lastExtraEnv = req.extraEnv;
  const args = mod.buildArgs(req);
  callbacks.onStart?.(`${req.dotnetPath} ${args.join(" ")}`);
  const trxPath = mod.resolveTrxPath(req);

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
}

function createProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-runexec-"));
  tempDirs.push(dir);
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

function executionRequest(
  projectDir: string,
  targets: RunTarget[],
  overrides: Partial<RunRequest> = {},
): RunRequest {
  return {
    targets,
    stage: "test",
    mode: "parallel",
    settings: { ...DEFAULT_SETTINGS },
    projectDir,
    locale: "en",
    totalExpected: 1,
    ...overrides,
  };
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

function passedPlaceOrderTrx(): string {
  return trxDocument(
    unitResult({
      testName: "OrdersFeature.PlaceOrder",
      outcome: "Passed",
      duration: "00:00:01.2500000",
    }),
  );
}

function expectNoSecret(value: unknown, secret: string): void {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  assert.strictEqual(typeof serialized, "string");
  assert.ok(!serialized.includes(secret));
}

function service(): RunService {
  if (!RunServiceCtor) {
    throw new Error("RunService host was not installed");
  }
  return new RunServiceCtor();
}

describe("RunService.runExecution characterization", { concurrency: false }, () => {
  before(async () => {
    installHost();
    const loaded = nodeRequire("../providers/runService") as typeof import("../providers/runService");
    RunServiceCtor = loaded.RunService;
  });

  after(() => {
    const Module = nodeRequire("module") as NodeModuleWithRequire;
    if (originalRequire) {
      Module.prototype.require = originalRequire;
    }
  });

  beforeEach(() => {
    script = { mode: "complete" };
    signalAbortedAtEntry = false;
    lastDotnetFilter = undefined;
    lastExtraEnv = undefined;
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records a passed scenario, the Reqnroll filter, duration, and history", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    script = { mode: "complete", exitCode: 0, trxXml: passedPlaceOrderTrx() };
    const runService = service();
    const historyEvents: string[] = [];
    const completed: number[] = [];
    runService.onHistoryChanged((entries) => {
      historyEvents.push(entries[entries.length - 1]?.id ?? "");
    });
    runService.onRunCompleted(() => {
      completed.push(1);
    });

    const result = await runService.runExecution(executionRequest(projectDir, [target]));

    const entry = result.historyEntry;
    assert.ok(entry);
    assert.strictEqual(result.canceled, false);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.summary?.source, "trx");
    assert.strictEqual(result.summary?.passed, 1);
    assert.strictEqual(result.summary?.failed, 0);
    assert.strictEqual(result.summary?.total, 1);
    assert.strictEqual(result.summary?.results[0]?.outcome, "passed");
    assert.strictEqual(result.summary?.results[0]?.durationMs, 1250);
    assert.strictEqual(entry.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.strictEqual(lastDotnetFilter, entry.filter);
    assert.strictEqual(entry.scopeLabel, "Orders.feature · Place order (scenario)");
    assert.strictEqual(entry.scopeLabel, formatRunTargetScopeLabels([target]).join(" | "));
    assert.strictEqual(entry.stage, "test");
    assert.strictEqual(entry.mode, "parallel");
    assert.strictEqual(entry.runKind, "run");
    assert.strictEqual(entry.status, "completed");
    assert.strictEqual(entry.passed, 1);
    assert.strictEqual(entry.failed, 0);
    assert.strictEqual(entry.skipped, 0);
    assert.strictEqual(entry.total, 1);
    assert.ok(entry.durationMs !== undefined && entry.durationMs >= 0 && entry.durationMs < 10_000);
    assert.match(entry.id, /^run-\d+$/);
    assert.strictEqual(entry.scenarios.length, 1);
    const scenario = entry.scenarios[0];
    assert.ok(scenario);
    assert.strictEqual(scenario.featurePath, target.kind === "scenario" ? target.feature.filePath : "");
    assert.strictEqual(scenario.scenarioLine, 12);
    assert.strictEqual(scenario.scenarioName, "Place order");
    assert.strictEqual(scenario.outcome, "passed");
    assert.strictEqual(scenario.durationMs, 1250);
    assert.strictEqual(
      scenarioHistoryKey(scenario.featurePath, scenario.scenarioLine, scenario.scenarioName),
      `${scenario.featurePath}::12::Place order`,
    );
    assert.ok(entry.trxPath && path.isAbsolute(entry.trxPath) && fs.existsSync(entry.trxPath));
    const command = runService.getLastEffectiveDotnetCommand();
    assert.ok(command?.commandLine.includes("--filter"));
    assert.ok(command?.commandLine.includes("FullyQualifiedName~OrdersFeature.PlaceOrder"));
    assert.strictEqual(runService.getHistory().length, 1);
    assert.strictEqual(runService.getHistory()[0], entry);
    assert.deepStrictEqual(historyEvents, [entry.id]);
    assert.strictEqual(completed.length, 1);
    assert.strictEqual(runService.getLastRunSnapshot()?.status, "completed");
    assert.strictEqual(runService.getLastRunSnapshot()?.summary.passed, 1);
    assert.strictEqual(runService.getLastFailedFilter(), undefined);
    assert.strictEqual(runService.getLastFailedRunSnapshot(), undefined);
  });

  it("records a failed scenario outcome, duration, and the parsed error", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    const errorMessage = "Expected 401 but got 200";
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: errorMessage,
        }),
      ),
    };

    const runService = service();
    const result = await runService.runExecution(executionRequest(projectDir, [target]));
    const entry = result.historyEntry;
    assert.ok(entry);
    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.canceled, false);
    assert.strictEqual(entry.status, "completed");
    assert.strictEqual(entry.passed, 0);
    assert.strictEqual(entry.failed, 1);
    assert.strictEqual(entry.total, 1);
    assert.strictEqual(entry.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
    const scenario = entry.scenarios[0];
    assert.ok(scenario);
    assert.strictEqual(scenario.outcome, "failed");
    assert.strictEqual(scenario.durationMs, 500);
    assert.strictEqual(scenario.errorMessage, errorMessage);
    assert.strictEqual(scenario.scenarioLine, 12);
    assert.strictEqual(scenario.scenarioName, "Place order");

    const failed = runService.getLastFailedRunSnapshot();
    assert.ok(failed);
    assert.strictEqual(failed.exitCode, 1);
    assert.strictEqual(failed.summary.failed, 1);
    assert.strictEqual(failed.failedScenarios[0]?.errorMessage, errorMessage);
    assert.strictEqual(failed.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.strictEqual(runService.getLastFailedFilter(), "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.strictEqual(runService.getLastFailedTargets().length, 1);
    assert.strictEqual(runService.getLastRunSnapshot()?.failedScenarios[0]?.errorMessage, errorMessage);
    assert.strictEqual(runService.getLastRunSnapshot()?.status, "completed");
    const artifact = readLastFailureArtifact(projectDir);
    assert.ok(artifact);
    assert.strictEqual(artifact.summary.failed, 1);
    assert.strictEqual(artifact.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
  });

  it("stores an unmatched TRX row as testName at line 0", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    const errorMessage = "boom";
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "HelperTests.TotallyDifferent",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: errorMessage,
        }),
      ),
    };
    const runService = service();

    const result = await runService.runExecution(executionRequest(projectDir, [target]));
    const scenario = result.historyEntry?.scenarios[0];
    assert.ok(scenario);
    assert.strictEqual(result.historyEntry?.scenarios.length, 1);
    assert.strictEqual(scenario.featurePath, "");
    assert.strictEqual(scenario.scenarioLine, 0);
    assert.strictEqual(scenario.scenarioName, "HelperTests.TotallyDifferent");
    assert.strictEqual(scenario.outcome, "failed");
    assert.strictEqual(scenario.durationMs, 500);
    assert.strictEqual(scenario.errorMessage, errorMessage);
    assert.strictEqual(
      scenarioHistoryKey(scenario.featurePath, scenario.scenarioLine, scenario.scenarioName),
      "::0::HelperTests.TotallyDifferent",
    );
    assert.deepStrictEqual(runService.getLastFailedTargets(), []);
    assert.strictEqual(runService.getLastFailedFilter(), "FullyQualifiedName~TotallyDifferent");
    assert.strictEqual(result.historyEntry?.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
  });

  it("keeps only matched scenarios when another TRX row does not match", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        [
          unitResult({
            testName: "OrdersFeature.PlaceOrder",
            outcome: "Passed",
            duration: "00:00:01.2500000",
          }),
          unitResult({
            testName: "HelperTests.TotallyDifferent",
            outcome: "Failed",
            duration: "00:00:00.2500000",
            message: "unmatched boom",
          }),
        ].join(""),
      ),
    };
    const runService = service();

    const result = await runService.runExecution(executionRequest(projectDir, [target]));

    assert.strictEqual(result.summary?.results.length, 2);
    assert.strictEqual(result.historyEntry?.scenarios.length, 1);
    assert.strictEqual(result.historyEntry?.scenarios[0]?.scenarioName, "Place order");
    assert.strictEqual(result.historyEntry?.scenarios[0]?.outcome, "passed");
    assert.strictEqual(result.historyEntry?.passed, 1);
    assert.strictEqual(result.historyEntry?.failed, 1);
    assert.deepStrictEqual(runService.getLastFailedTargets(), []);
    assert.strictEqual(runService.getLastFailedFilter(), "FullyQualifiedName~TotallyDifferent");
  });

  it("leaves previously matched failed targets in place when a later failure does not match", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    const runService = service();
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: "first",
        }),
      ),
    };
    await runService.runExecution(executionRequest(projectDir, [target]));
    assert.strictEqual(runService.getLastFailedTargets().length, 1);

    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "HelperTests.TotallyDifferent",
          outcome: "Failed",
          message: "second",
        }),
      ),
    };
    await runService.runExecution(executionRequest(projectDir, [target]));

    const targets = runService.getLastFailedTargets();
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0]?.kind, "scenario");
    if (targets[0]?.kind === "scenario") {
      assert.strictEqual(targets[0].scenario.name, "Place order");
    }
    assert.strictEqual(runService.getLastFailedFilter(), "FullyQualifiedName~TotallyDifferent");
  });

  it("records an outline row on the scenario identity and the row filter", async () => {
    const projectDir = createProject();
    const orders = feature(projectDir);
    const scenario = addItem();
    const example = widgetRow();
    const target: RunTarget = { kind: "outlineRow", feature: orders, scenario, example };
    script = {
      mode: "complete",
      exitCode: 0,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.AddItem(widget)",
          outcome: "Passed",
          duration: "00:00:01.2500000",
        }),
      ),
    };

    const runService = service();
    const result = await runService.runExecution(executionRequest(projectDir, [target]));
    const recorded = result.historyEntry?.scenarios[0];
    assert.ok(recorded);
    assert.strictEqual(result.historyEntry?.filter, 'DisplayName~sku: %22widget%22');
    assert.strictEqual(lastDotnetFilter, 'DisplayName~sku: %22widget%22');
    const commandLine = runService.getLastEffectiveDotnetCommand()?.commandLine ?? "";
    assert.ok(commandLine.includes("DisplayName~sku: %22widget%22"));
    assert.strictEqual(recorded.featurePath, orders.filePath);
    assert.strictEqual(recorded.scenarioLine, 8);
    assert.notStrictEqual(recorded.scenarioLine, example.line);
    assert.strictEqual(recorded.scenarioName, "Add item");
    assert.strictEqual(recorded.outcome, "passed");
    assert.strictEqual(recorded.durationMs, 1250);
    assert.strictEqual(
      scenarioHistoryKey(recorded.featurePath, recorded.scenarioLine, recorded.scenarioName),
      `${orders.filePath}::8::Add item`,
    );
    assert.notStrictEqual(
      scenarioHistoryKey(recorded.featurePath, recorded.scenarioLine, recorded.scenarioName),
      outlineRowKey(orders, scenario, example.rowIndex),
    );
    assert.strictEqual(
      result.historyEntry?.scopeLabel,
      "Orders.feature · Add item — sku=widget (outline row)",
    );
  });

  it("reloads persisted history and records rawFilter, counts, and duration", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    script = { mode: "complete", exitCode: 0, trxXml: passedPlaceOrderTrx() };
    const first = service();
    const firstResult = await first.runExecution(executionRequest(projectDir, [target]));
    assert.ok(firstResult.historyEntry);
    if (!RunServiceCtor) {
      throw new Error("RunService host was not installed");
    }
    const saved = first.getHistory();
    const second = new RunServiceCtor(() => saved);

    assert.strictEqual(second.getHistory().length, 1);
    assert.strictEqual(second.getHistory()[0]?.id, firstResult.historyEntry.id);

    script = { mode: "complete", exitCode: 0, trxXml: passedPlaceOrderTrx() };
    const rawFilter = "FullyQualifiedName~Custom.Override";
    const secondResult = await second.runExecution(
      executionRequest(projectDir, [target], { rawFilter }),
    );

    assert.strictEqual(second.getHistory().length, 2);
    assert.strictEqual(second.getHistory()[0]?.id, firstResult.historyEntry.id);
    assert.strictEqual(secondResult.historyEntry?.filter, rawFilter);
    assert.strictEqual(lastDotnetFilter, rawFilter);
    assert.strictEqual(secondResult.historyEntry?.scopeLabel, "Orders.feature · Place order (scenario)");
    assert.strictEqual(secondResult.historyEntry?.passed, 1);
    assert.strictEqual(secondResult.historyEntry?.failed, 0);
    assert.strictEqual(secondResult.historyEntry?.scenarios[0]?.durationMs, 1250);
    assert.ok(second.getLastEffectiveDotnetCommand()?.commandLine.includes(rawFilter));
    assert.ok(
      !second.getLastEffectiveDotnetCommand()?.commandLine.includes("FullyQualifiedName~OrdersFeature.PlaceOrder"),
    );
  });

  it("clears the failure snapshot and artifact after a later pass and keeps prior failed targets", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    const runService = service();
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          message: "first failure",
        }),
      ),
    };
    await runService.runExecution(executionRequest(projectDir, [target]));
    assert.ok(readLastFailureArtifact(projectDir));
    assert.strictEqual(runService.getLastFailedTargets().length, 1);

    script = { mode: "complete", exitCode: 0, trxXml: passedPlaceOrderTrx() };
    const result = await runService.runExecution(executionRequest(projectDir, [target]));

    assert.strictEqual(result.historyEntry?.scenarios[0]?.outcome, "passed");
    assert.strictEqual(runService.getHistory().length, 2);
    assert.strictEqual(runService.getLastFailedRunSnapshot(), undefined);
    assert.strictEqual(runService.getLastFailedFilter(), undefined);
    assert.strictEqual(readLastFailureArtifact(projectDir), undefined);
    assert.strictEqual(fs.existsSync(resolveLastFailureLogPath(projectDir)), false);
    assert.strictEqual(runService.getLastFailedTargets().length, 1);
    assert.strictEqual(runService.getLastFailedTargets()[0]?.kind, "scenario");
    assert.strictEqual(runService.getLastRunSnapshot()?.status, "completed");
    assert.strictEqual(runService.getLastRunSnapshot()?.summary.failed, 0);
  });

  it("records no history when the run aborts before any result", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    const runService = service();
    script = {
      mode: "complete",
      exitCode: 1,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          message: "keep me",
        }),
      ),
    };
    await runService.runExecution(executionRequest(projectDir, [target]));
    const failedBefore = runService.getLastFailedRunSnapshot();
    const sessionBefore = runService.getLastRunSnapshot();
    assert.ok(failedBefore);
    assert.ok(sessionBefore);
    // createRunTrxFileName() is `bdd-pilot-${Date.now()}.trx`. Separate the calls so abort cannot reopen that file.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const controller = new AbortController();
    controller.abort();
    script = { mode: "abort-before", forced: true };
    let historyEvents = 0;
    let completed = 0;
    const historySub = runService.onHistoryChanged(() => {
      historyEvents += 1;
    });
    const completedSub = runService.onRunCompleted(() => {
      completed += 1;
    });

    const result = await runService.runExecution(
      executionRequest(projectDir, [target], { signal: controller.signal }),
    );

    historySub.dispose();
    completedSub.dispose();
    assert.strictEqual(signalAbortedAtEntry, true);
    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.forced, true);
    assert.strictEqual(result.exitCode, null);
    assert.strictEqual(result.historyEntry, undefined);
    assert.strictEqual(result.summary, undefined);
    assert.strictEqual(runService.getHistory().length, 1);
    assert.strictEqual(runService.getHistory()[0]?.status, "completed");
    assert.strictEqual(historyEvents, 0);
    assert.strictEqual(completed, 1);
    assert.strictEqual(runService.getLastFailedRunSnapshot(), failedBefore);
    assert.deepStrictEqual(runService.getLastRunSnapshot(), sessionBefore);
    assert.strictEqual(runService.getLastFailedFilter(), "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.ok(result.outputBuffer.includes("[bdd-pilot]"));
    assert.ok(!result.outputBuffer.includes("Run canceled"));
  });

  it("records canceled history from live progress when no TRX is available", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    script = {
      mode: "abort-during",
      stdout: "[xUnit.net 00:00:01.00] Passed OrdersFeature.PlaceOrder [10 ms]\n",
    };
    const runService = service();

    const result = await runService.runExecution(executionRequest(projectDir, [target]));
    const entry = result.historyEntry;
    assert.ok(entry);
    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.exitCode, null);
    assert.strictEqual(result.summary, undefined);
    assert.match(entry.id, /^run-cancel-\d+$/);
    assert.strictEqual(entry.status, "canceled");
    assert.strictEqual(entry.passed, 1);
    assert.strictEqual(entry.failed, 0);
    assert.strictEqual(entry.skipped, 0);
    assert.strictEqual(entry.total, 1);
    assert.deepStrictEqual(entry.scenarios, []);
    assert.strictEqual(entry.filter, "FullyQualifiedName~OrdersFeature.PlaceOrder");
    assert.ok(entry.durationMs !== undefined && entry.durationMs >= 0);
    assert.strictEqual(runService.getLastFailedRunSnapshot(), undefined);
    assert.strictEqual(runService.getLastFailedFilter(), undefined);
    assert.strictEqual(runService.getLastRunSnapshot()?.status, "canceled");
    assert.strictEqual(runService.getLastRunSnapshot()?.summary.passed, 1);
    assert.strictEqual(runService.getLastRunSnapshot()?.summary.total, 1);
    assert.deepStrictEqual(runService.getLastRunSnapshot()?.failedScenarios, []);
  });

  it("prefers the TRX summary over live counts when a canceled run still has results", async () => {
    const projectDir = createProject();
    const target = scenarioTarget(projectDir);
    script = {
      mode: "abort-during-with-trx",
      stdout: "[xUnit.net 00:00:01.00] Passed OrdersFeature.PlaceOrder [10 ms]\n",
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: "canceled after failure",
        }),
      ),
    };
    const runService = service();

    const result = await runService.runExecution(executionRequest(projectDir, [target]));
    const entry = result.historyEntry;
    assert.ok(entry);
    assert.strictEqual(result.canceled, true);
    assert.strictEqual(result.summary?.failed, 1);
    assert.strictEqual(entry.status, "canceled");
    assert.strictEqual(entry.passed, 0);
    assert.strictEqual(entry.failed, 1);
    assert.strictEqual(entry.total, 1);
    assert.strictEqual(entry.scenarios.length, 1);
    assert.strictEqual(entry.scenarios[0]?.outcome, "failed");
    assert.strictEqual(entry.scenarios[0]?.durationMs, 500);
    assert.strictEqual(entry.scenarios[0]?.errorMessage, "canceled after failure");
    assert.strictEqual(runService.getLastFailedRunSnapshot(), undefined);
    assert.deepStrictEqual(runService.getLastFailedTargets(), []);
    assert.strictEqual(runService.getLastFailedFilter(), undefined);
    assert.strictEqual(runService.getLastRunSnapshot()?.status, "canceled");
    assert.strictEqual(runService.getLastRunSnapshot()?.summary.failed, 1);
    assert.strictEqual(
      runService.getLastRunSnapshot()?.failedScenarios[0]?.errorMessage,
      "canceled after failure",
    );
  });

  it("redacts a TRX error before history, snapshots, and the public history DTO", async () => {
    const projectDir = createProject();
    fs.mkdirSync(path.join(projectDir, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "config", ".env.test"),
      `CLIENT_SECRET=${ENV_SECRET}\n`,
      "utf8",
    );
    const target = scenarioTarget(projectDir);
    const rawError = `CLIENT_SECRET=${TRX_SECRET} expected 401`;
    const storedError = "CLIENT_SECRET=***REDACTED*** expected 401";
    script = {
      mode: "complete",
      exitCode: 1,
      stdout: `password=${STDOUT_SECRET} while running\n`,
      stderr: `api_key=${STDERR_SECRET}\n`,
      trxXml: trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          duration: "00:00:00.5000000",
          message: rawError,
        }),
      ),
    };
    const chunks: string[] = [];
    const runService = service();
    let persistedHistory: unknown;
    const historySub = runService.onHistoryChanged(() => {
      persistedHistory = runService.getHistory();
    });
    const result = await runService.runExecution(
      executionRequest(projectDir, [target], {
        onOutput: (chunk) => {
          chunks.push(chunk);
        },
      }),
    );
    historySub.dispose();

    assert.strictEqual(lastExtraEnv?.CLIENT_SECRET, ENV_SECRET);
    const output = result.outputBuffer;
    assert.strictEqual(chunks.join(""), output);
    assert.ok(output.includes("***REDACTED***"));
    assert.ok(!output.includes(STDOUT_SECRET));
    assert.ok(!output.includes(STDERR_SECRET));
    assert.ok(!output.includes(ENV_SECRET));
    assert.ok(output.includes("password="));
    assert.ok(output.includes("api_key="));
    expectNoSecret(output, TRX_SECRET);

    assert.ok(result.historyEntry);
    assert.strictEqual(result.historyEntry.scenarios[0]?.errorMessage, storedError);
    expectNoSecret(runService.getHistory(), TRX_SECRET);
    expectNoSecret(persistedHistory, TRX_SECRET);
    expectNoSecret(runService.getHistory(), STDOUT_SECRET);
    expectNoSecret(runService.getHistory(), STDERR_SECRET);
    expectNoSecret(runService.getHistory(), ENV_SECRET);

    const failure = runService.getLastFailedRunSnapshot();
    assert.ok(failure);
    assert.strictEqual(failure.failedScenarios[0]?.errorMessage, storedError);
    expectNoSecret(failure.failedScenarios, TRX_SECRET);
    expectNoSecret(failure.outputForAnalysis, TRX_SECRET);
    expectNoSecret(failure.outputForAnalysis, STDOUT_SECRET);
    expectNoSecret(failure.outputForAnalysis, STDERR_SECRET);
    expectNoSecret(failure.outputForAnalysis, ENV_SECRET);
    assert.ok(failure.outputForAnalysis.includes("***REDACTED***"));
    assert.strictEqual(failure.trxSummary?.results[0]?.errorMessage, rawError);

    const session = runService.getLastRunSnapshot();
    assert.ok(session);
    assert.strictEqual(session.failedScenarios[0]?.errorMessage, storedError);
    expectNoSecret(session, TRX_SECRET);
    expectNoSecret(session, STDOUT_SECRET);
    expectNoSecret(session, ENV_SECRET);

    const historyDto = mapHistoryEntry(result.historyEntry);
    const lastRunDto = mapLastRun(session);
    assert.strictEqual(historyDto.scenarios[0]?.errorMessage, storedError);
    assert.strictEqual(lastRunDto.failedScenarios[0]?.errorMessage, storedError);
    expectNoSecret(historyDto, TRX_SECRET);
    expectNoSecret(lastRunDto, TRX_SECRET);

    const artifact = readLastFailureArtifact(projectDir);
    assert.ok(artifact);
    const artifactText = fs.readFileSync(
      path.join(projectDir, "TestResults", "bdd-pilot-last-failure.json"),
      "utf8",
    );
    const logText = fs.readFileSync(resolveLastFailureLogPath(projectDir), "utf8");
    const persisted = `${artifactText}\n${logText}`;
    assert.ok(logText.includes("***REDACTED***"));
    expectNoSecret(persisted, STDOUT_SECRET);
    expectNoSecret(persisted, STDERR_SECRET);
    expectNoSecret(persisted, ENV_SECRET);
    expectNoSecret(persisted, TRX_SECRET);
  });

  it("sanitizes the Test Explorer failure message and leaves the parsed TRX error raw", () => {
    const secret = "explorer-secret-value";
    const raw = `Expected status 200 but received 500. CLIENT_SECRET=${secret}`;
    const parsed = parseTrx(
      trxDocument(
        unitResult({
          testName: "OrdersFeature.PlaceOrder",
          outcome: "Failed",
          message: raw,
        }),
      ),
    );
    assert.strictEqual(parsed.results[0]?.errorMessage, raw);

    const projectDir = createProject();
    const message = service().buildFailureMessage(projectDir, parsed.results[0]?.errorMessage);
    const text = String(message.message);

    assert.strictEqual(
      text,
      "Expected status 200 but received 500. CLIENT_SECRET=***REDACTED***",
    );
    assert.ok(text.includes("Expected status 200 but received 500"));
    assert.ok(text.includes("***REDACTED***"));
    assert.ok(!text.includes(secret));
    assert.strictEqual(parsed.results[0]?.errorMessage, raw);

    const store = new OutcomeStore();
    const key = `${projectDir}/Orders.feature::12::Place order`;
    store.set(key, "failed", 500, parsed.results[0]?.errorMessage);
    const stored = store.getErrorMessage(key) ?? "";
    assert.strictEqual(stored, text);
    assert.ok(!stored.includes(secret));
  });
});
