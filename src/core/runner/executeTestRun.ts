import * as path from "path";
import { loadStageEnv } from "../config/envFile";
import { MODE_PROFILES, ParallelismMode, RunnerSettings, Stage } from "../config/types";
import { DomainGroup } from "../gherkin/model";
import { loadRunResults, UnifiedSummary } from "../results/resultLoader";
import { ScenarioRunRecord } from "../results/runHistory";
import { sanitize } from "../../security/sanitizer";
import { RunTarget, buildCombinedFilter } from "./filterBuilder";
import { FilterMappingConfig } from "./filterMapping";
import { LiveProgressParser, LiveProgressState, TestCompletionEvent } from "./liveProgress";
import { matchRunTarget } from "./matchRunTarget";
import {
  buildArgs,
  runDotnetTest as defaultRunDotnetTest,
  RunCallbacks,
  RunRequest as DotnetRunRequest,
  RunResult,
} from "./dotnetTest";
import { resolveRunSettingsPath } from "./runSettingsPath";
import { resolveEffectiveRunFlags } from "./stageRunFlags";
import { createRunTrxFileName } from "./trxArgs";

export type RunDotnetTestFn = (
  req: DotnetRunRequest,
  callbacks: RunCallbacks,
  signal: AbortSignal,
) => Promise<RunResult>;

export interface ExecutionFilterInput {
  rawFilter?: string;
  targets: RunTarget[];
  filterMapping: FilterMappingConfig;
}

/** Same filter `RunService` sends to `dotnet test`. Empty `rawFilter` falls through. */
export function resolveExecutionFilter(input: ExecutionFilterInput): string | undefined {
  return (
    input.rawFilter?.trim() ||
    (input.targets.length === 0 || input.targets.some((target) => target.kind === "all")
      ? undefined
      : buildCombinedFilter(input.targets, input.filterMapping))
  );
}

export interface DotnetTestRequestInput {
  settings: RunnerSettings;
  stage: Stage;
  mode: ParallelismMode;
  projectDir: string;
  testTarget?: string;
  filter?: string;
  trxFileName: string;
  extraEnv?: Record<string, string>;
  /** First workspace folder, when the caller has one. Never read from VS Code here. */
  workspaceRoot?: string;
}

/** Pure `dotnet test` request. Callers own dialogs, debug launch, and pre-command text. */
export function buildDotnetTestRequest(input: DotnetTestRequestInput): DotnetRunRequest {
  const effective = resolveEffectiveRunFlags({
    stage: input.stage,
    runConfiguration: input.settings.runConfiguration,
    runSettingsPath: input.settings.runSettingsPath,
    byStage: input.settings.runByStage ?? {},
  });
  const resolution = resolveRunSettingsPath(input.workspaceRoot, effective.runSettingsPath);
  const configuration = effective.runConfiguration.trim() || undefined;
  return {
    dotnetPath: input.settings.dotnetPath,
    projectDir: input.projectDir,
    testTarget: input.testTarget,
    filter: input.filter,
    stage: input.stage,
    mode: MODE_PROFILES[input.mode],
    resultsDir: "TestResults",
    trxFileName: input.trxFileName,
    configuration,
    noBuild: input.settings.runNoBuild,
    settingsPath: resolution.settingsPath,
    cliVerbosity: input.settings.runCliVerbosity.trim() || undefined,
    blame: input.settings.runBlame || undefined,
    blameHang: input.settings.runBlameHang === "on" || undefined,
    blameHangTimeout:
      input.settings.runBlameHang === "on"
        ? input.settings.runBlameHangTimeout.trim() || "10m"
        : undefined,
    extraEnv: input.extraEnv,
  };
}

/**
 * Match TRX/Cucumber rows to the requested targets.
 * `errorMessage` stays raw. Callers sanitize when they copy into history or snapshots.
 * Zero matches fall back to one row per result (`featurePath: ""`, `scenarioLine: 0`).
 */
export function matchScenarioRecords(
  targets: RunTarget[],
  summary: UnifiedSummary,
  domains: DomainGroup[] = [],
): ScenarioRunRecord[] {
  const scenarios: ScenarioRunRecord[] = [];
  for (const result of summary.results) {
    const match = matchRunTarget(targets, result.testName, domains);
    if (match) {
      scenarios.push({
        featurePath: match.feature.filePath,
        scenarioLine: match.scenario.line,
        scenarioName: match.scenario.name,
        outcome: result.outcome,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
      });
    }
  }
  if (scenarios.length === 0) {
    for (const result of summary.results) {
      scenarios.push({
        featurePath: "",
        scenarioLine: 0,
        scenarioName: result.testName,
        outcome: result.outcome,
        durationMs: result.durationMs,
        errorMessage: result.errorMessage,
      });
    }
  }
  return scenarios;
}

export interface ExecuteTestRunInput {
  targets: RunTarget[];
  rawFilter?: string;
  stage: Stage;
  mode: ParallelismMode;
  settings: RunnerSettings;
  projectDir: string;
  testTarget?: string;
  domains?: DomainGroup[];
  totalExpected?: number;
  workspaceRoot?: string;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  onStart?: (command: string) => void;
  onProgress?: (state: LiveProgressState, event?: TestCompletionEvent) => void;
  /** Wall-clock start used by the caller for duration. After env load and TRX file name. */
  onRunStarted?: () => void;
  /** Argv of the `dotnet test` process, before stdout is captured. */
  onEffectiveCommand?: (dotnetPath: string, args: string[]) => void;
  /** Test seam. Production uses `runDotnetTest`. */
  runDotnetTest?: RunDotnetTestFn;
}

export interface ExecuteTestRunResult {
  filter?: string;
  exitCode: number | null;
  canceled: boolean;
  forced?: boolean;
  /** Path returned by the runner. May be relative. */
  trxPath: string;
  /** Absolute path stored on history when a results file was named. */
  absoluteTrxPath?: string;
  /** Loaded summary. `errorMessage` values stay raw. Absent when nothing was readable. */
  summary?: UnifiedSummary;
  /** Sanitized stdout, stderr, and command line. */
  outputBuffer: string;
  liveState: LiveProgressState;
  /**
   * Matched rows for the caller to copy into history.
   * `errorMessage` stays raw. Empty when no summary was loaded.
   */
  matchedScenarios: ScenarioRunRecord[];
}

/**
 * Authorized BDD execution: filter, `dotnet test`, sanitized capture, result load, match.
 * The caller has already applied preflight. This function does not persist or present anything.
 */
export async function executeTestRun(input: ExecuteTestRunInput): Promise<ExecuteTestRunResult> {
  const filter = resolveExecutionFilter({
    rawFilter: input.rawFilter,
    targets: input.targets,
    filterMapping: input.settings.filterMapping,
  });
  const loadedEnv = loadStageEnv(input.projectDir, input.stage);
  const trxFileName = createRunTrxFileName();
  input.onRunStarted?.();
  const progressParser = new LiveProgressParser(input.totalExpected);
  const dotnetReq = buildDotnetTestRequest({
    settings: input.settings,
    stage: input.stage,
    mode: input.mode,
    projectDir: input.projectDir,
    testTarget: input.testTarget,
    filter,
    trxFileName,
    extraEnv: loadedEnv.vars,
    workspaceRoot: input.workspaceRoot,
  });

  let outputBuffer = "";
  const capture = (chunk: string): void => {
    const clean = sanitize(chunk);
    outputBuffer += clean;
    input.onOutput?.(clean);
    for (const event of progressParser.feed(clean)) {
      input.onProgress?.(progressParser.getState(), event);
    }
  };

  const run = input.runDotnetTest ?? defaultRunDotnetTest;
  const result = await run(
    dotnetReq,
    {
      onStart: (cmd) => {
        input.onEffectiveCommand?.(dotnetReq.dotnetPath, buildArgs(dotnetReq));
        input.onStart?.(cmd);
        capture(`[bdd-pilot] ${sanitize(cmd)}\n`);
      },
      onStdout: capture,
      onStderr: capture,
    },
    input.signal ?? new AbortController().signal,
  );

  const summary = loadRunResults(input.projectDir, result.trxPath);
  return {
    filter,
    exitCode: result.exitCode,
    canceled: result.canceled,
    forced: result.forced,
    trxPath: result.trxPath,
    absoluteTrxPath: toAbsoluteTrxPath(result.trxPath),
    summary,
    outputBuffer,
    liveState: progressParser.getState(),
    matchedScenarios: summary
      ? matchScenarioRecords(input.targets, summary, input.domains ?? [])
      : [],
  };
}

function toAbsoluteTrxPath(trxPath: string | undefined): string | undefined {
  if (!trxPath) {
    return undefined;
  }
  return path.isAbsolute(trxPath) ? trxPath : path.resolve(trxPath);
}
