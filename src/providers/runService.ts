import * as path from "path";
import * as vscode from "vscode";
import {
  formatRunTargetScopeLabels,
  LastRunSnapshot,
} from "../core/diagnostics/aiFailureContext";
import {
  clearLastFailureArtifact,
  writeLastFailureArtifact,
} from "../core/diagnostics/lastFailureArtifact";
import { classifyRunCompletion, RunCompletionKind } from "../core/diagnostics/runOutcomeClass";
import { AnalyzeDotnetOutputOptions } from "../core/diagnostics/analyzer";
import { loadStageEnv } from "../core/config/envFile";
import { ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { PilotLocale, t } from "../core/i18n";
import { DomainGroup } from "../core/gherkin/model";
import { findRecentEvidence } from "../core/results/evidence";
import { loadRunResults, UnifiedSummary } from "../core/results/resultLoader";
import {
  createDebugTrxFileName,
  resolveTrxPath,
} from "../core/runner/trxArgs";
import { RunTarget, buildFilter } from "../core/runner/filterBuilder";
import { formatPreRunDrySummary } from "../core/runner/preRunDrySummary";
import { LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { buildArgs, RunRequest as DotnetRunRequest, runDotnetTest } from "../core/runner/dotnetTest";
import {
  buildAttachDebugConfig,
  DEBUG_HOST_ENV,
  parseTesthostPids,
} from "../core/runner/debugAttach";
import {
  buildDotnetTestRequest,
  executeTestRun,
  matchScenarioRecords,
  resolveExecutionFilter,
} from "../core/runner/executeTestRun";
import {
  EffectiveDotnetCommandSnapshot,
  formatEffectiveDotnetCommand,
} from "../core/runner/effectiveDotnetCommand";
import {
  formatRunSettingsMissingMessage,
  resolveRunSettingsPath,
} from "../core/runner/runSettingsPath";
import {
  formatStageRunFlagsAppliedMessage,
  resolveEffectiveRunFlags,
  stageRunFlagsDifferFromGlobal,
} from "../core/runner/stageRunFlags";
import {
  resolveRunKind,
  RunHistoryEntry,
  RunKind,
  ScenarioRunRecord,
  trimHistory,
} from "../core/results/runHistory";
import {
  buildSessionRunSnapshot,
  cloneSessionRunSnapshot,
  SessionRunSnapshot,
} from "../core/results/sessionRunSnapshot";
import { matchRunTarget } from "../core/runner/matchRunTarget";
import { evaluateRun } from "../security/envGuard";
import { sanitize } from "../security/sanitizer";
import { BindingGateMode } from "../core/bindings/resolveBindingGateUx";
import { collectStepsForRunScope } from "../core/bindings/collectStepsForRunScope";
import { evaluateBindingGate } from "../core/bindings/evaluateBindingGate";
import { resolveBindingGateUx } from "../core/bindings/resolveBindingGateUx";
import {
  formatBindingGateAmbiguousOutput,
  formatBindingGateUnboundPrompt,
} from "../core/bindings/bindingGateMessages";
import {
  resolveUnboundPromptKind,
  shouldLogAmbiguousIssues,
  shouldPromptForUnboundIssues,
} from "../core/bindings/bindingGatePresentation";
import { BindingGateIssue } from "../core/bindings/evaluateBindingGate";
import { RunPreflightResult } from "../core/bindings/runPreflight";
import { GuardianSkipReason, tryGetGuardianResolveStep } from "./guardianIntegration";

export interface RunRequest {
  targets: RunTarget[];
  /** When set, bypasses target-derived filter (execution profiles / re-run failed). */
  rawFilter?: string;
  stage: Stage;
  mode: ParallelismMode;
  settings: RunnerSettings;
  projectDir: string;
  testTarget?: string;
  debug?: boolean;
  /**
   * Explicit session kind. Prefer `resolveRunKind` at the call site.
   * Do not infer `profile` from `rawFilter` alone (re-run failed also uses rawFilter).
   */
  runKind?: RunKind;
  /** UI locale for confirmation dialogs. */
  locale: PilotLocale;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  onStart?: (cmd: string) => void;
  /** Expected test count for progress UI (outline rows included). */
  totalExpected?: number;
  /** Fired as stdout is parsed; includes per-test completion events. */
  onProgress?: (state: LiveProgressState, event?: TestCompletionEvent) => void;
  /** Pre-run binding gate mode (Guardian resolveStep). */
  bindingGate?: BindingGateMode;
  /** Discovery domains for binding gate scope. */
  domains?: DomainGroup[];
  /** Analyzer options (extended rules, locale). */
  analyzeOptions?: AnalyzeDotnetOutputOptions;
}

export interface RunServiceResult {
  exitCode: number | null;
  canceled: boolean;
  trxPath: string;
  summary?: UnifiedSummary;
  outputBuffer: string;
  historyEntry?: RunHistoryEntry;
  /** Set when a debug session was launched and results arrive on session end. */
  debugStarted?: boolean;
  /** Abort escalated to SIGKILL / forced settle (Output `(forced).`). */
  forced?: boolean;
}

export interface DebugSessionResult {
  summary?: UnifiedSummary;
  trxPath: string;
  completionKind: RunCompletionKind;
  historyEntry?: RunHistoryEntry;
  filter?: string;
  targets: RunTarget[];
  stage: Stage;
  mode: ParallelismMode;
  projectDir: string;
}

export const BDD_PILOT_DEBUG_SESSION_NAME = "BDD Pilot Debug";

const HISTORY_MAX = 50;

interface PendingDebugSession {
  trxPath: string;
  req: RunRequest;
  filter?: string;
  controller: AbortController;
}

export class RunService {
  private readonly _onHistory = new vscode.EventEmitter<RunHistoryEntry[]>();
  readonly onHistoryChanged = this._onHistory.event;

  /** Fires when the debug `dotnet test` process exits (TRX is written by then). */
  private readonly _onDebugEnded = new vscode.EventEmitter<void>();
  readonly onDebugEnded = this._onDebugEnded.event;

  private readonly _onCompleteRun = new vscode.EventEmitter<void>();
  readonly onRunCompleted = this._onCompleteRun.event;

  private history: RunHistoryEntry[] = [];
  private lastFailedTargets: RunTarget[] = [];
  private lastFailedFilter: string | undefined;
  private lastFailedRunSnapshot: LastRunSnapshot | undefined;
  private lastRunSnapshot: SessionRunSnapshot | undefined;
  private lastEffectiveCommand: EffectiveDotnetCommandSnapshot | undefined;
  private runStartedAt = 0;
  private pendingDebug: PendingDebugSession | undefined;
  private debugActive = false;

  constructor(loadPersisted?: () => RunHistoryEntry[]) {
    if (loadPersisted) {
      this.history = loadPersisted();
    }
  }

  getHistory(): RunHistoryEntry[] {
    return [...this.history];
  }

  getLastFailedFilter(): string | undefined {
    return this.lastFailedFilter;
  }

  getLastFailedTargets(): RunTarget[] {
    return [...this.lastFailedTargets];
  }

  getLastFailedRunSnapshot(): LastRunSnapshot | undefined {
    return this.lastFailedRunSnapshot;
  }

  /**
   * Sets failure snapshot from TRX rehydrate (activate / Copy for AI lazy).
   * Caller must not invoke mid-run; does not clear live session data otherwise.
   */
  hydrateLastFailedRunSnapshot(snapshot: LastRunSnapshot): void {
    this.lastFailedRunSnapshot = snapshot;
  }

  getLastRunSnapshot(): SessionRunSnapshot | undefined {
    return this.lastRunSnapshot ? cloneSessionRunSnapshot(this.lastRunSnapshot) : undefined;
  }

  /** Last `dotnet test …` line from a session run/debug start (clipboard CF1). */
  getLastEffectiveDotnetCommand(): EffectiveDotnetCommandSnapshot | undefined {
    return this.lastEffectiveCommand ? { ...this.lastEffectiveCommand } : undefined;
  }

  private rememberEffectiveCommand(
    dotnetPath: string,
    args: string[],
    runKind: "run" | "debug",
  ): void {
    this.lastEffectiveCommand = {
      commandLine: formatEffectiveDotnetCommand({ dotnetPath, args }),
      updatedAt: Date.now(),
      runKind,
    };
  }

  setHistory(entries: RunHistoryEntry[]): void {
    this.history = entries;
    this._onHistory.fire(this.history);
  }

  isDebugActive(): boolean {
    return this.debugActive;
  }

  async runPreflight(req: RunRequest): Promise<RunPreflightResult> {
    const stageGate = await this.checkStageConfirmation(req);
    if (stageGate === "denied") {
      return { proceed: false, reason: "prod-denied" };
    }
    if (stageGate === "declined") {
      return { proceed: false, reason: "stage-declined" };
    }

    const gateProceed = await this.checkBindingGate(req);
    if (!gateProceed) {
      return { proceed: false, reason: "gate-declined" };
    }

    return { proceed: true };
  }

  async run(req: RunRequest): Promise<RunServiceResult> {
    const preflight = await this.runPreflight(req);
    if (!preflight.proceed) {
      return { exitCode: null, canceled: true, trxPath: "", outputBuffer: "" };
    }
    return this.runExecution(req);
  }

  async runExecution(req: RunRequest): Promise<RunServiceResult> {
    if (req.debug) {
      return this.runDebug(req, this.resolveDotnetFilter(req));
    }

    const executed = await executeTestRun({
      targets: req.targets,
      rawFilter: req.rawFilter,
      stage: req.stage,
      mode: req.mode,
      settings: req.settings,
      projectDir: req.projectDir,
      testTarget: req.testTarget,
      domains: req.domains,
      totalExpected: req.totalExpected,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      signal: req.signal,
      onOutput: req.onOutput,
      onStart: req.onStart,
      onProgress: req.onProgress,
      onRunStarted: () => {
        this.runStartedAt = Date.now();
      },
      onEffectiveCommand: (dotnetPath, args) => {
        this.rememberEffectiveCommand(dotnetPath, args, "run");
      },
    });

    const processResult = {
      exitCode: executed.exitCode,
      canceled: executed.canceled,
      trxPath: executed.trxPath,
    };
    const scenarios = sanitizeScenarioRecords(executed.matchedScenarios);
    const historyEntry = executed.canceled
      ? this.recordCanceledHistory(
          req,
          executed.filter,
          executed.summary,
          executed.liveState,
          executed.absoluteTrxPath,
          scenarios,
        )
      : this.recordHistory(req, executed.filter, executed.summary, executed.absoluteTrxPath, scenarios);
    if (historyEntry) {
      this.history = trimHistory(this.history, HISTORY_MAX);
      this._onHistory.fire(this.history);
    }
    if (!executed.canceled) {
      this.updateFailedRunSnapshot(
        req,
        executed.filter,
        processResult,
        executed.summary,
        executed.outputBuffer,
        historyEntry,
      );
    }
    this.updateSessionRunSnapshot(
      req,
      executed.filter,
      processResult,
      executed.summary,
      executed.outputBuffer,
      historyEntry,
      executed.liveState,
    );
    this.notifyRunCompleted();

    return {
      exitCode: executed.exitCode,
      canceled: executed.canceled,
      trxPath: executed.trxPath,
      summary: executed.summary,
      outputBuffer: executed.outputBuffer,
      historyEntry,
      forced: executed.forced,
    };
  }

  /** Called when the VS Code debug session launched by Pilot terminates. */
  finishDebugSession(): DebugSessionResult | undefined {
    const pending = this.pendingDebug;
    this.pendingDebug = undefined;
    this.debugActive = false;
    if (!pending) {
      return undefined;
    }

    const summary = loadRunResults(pending.req.projectDir, pending.trxPath);
    const completionKind = classifyRunCompletion({
      exitCode: summary && summary.total > 0 ? 0 : 1,
      canceled: pending.controller.signal.aborted,
      summary,
      outputBuffer: "",
    });

    let historyEntry: RunHistoryEntry | undefined;
    if (summary && summary.total > 0) {
      const absoluteTrxPath = toAbsoluteTrxPath(pending.trxPath);
      historyEntry = this.recordHistory(
        pending.req,
        pending.filter,
        summary,
        absoluteTrxPath,
        this.buildScenarioRecords(pending.req, summary),
      );
      if (historyEntry) {
        this.history = trimHistory(this.history, HISTORY_MAX);
        this._onHistory.fire(this.history);
      }
      this.updateFailedRunSnapshot(
        pending.req,
        pending.filter,
        { exitCode: 0, canceled: false, trxPath: pending.trxPath },
        summary,
        "",
        historyEntry,
      );
      this.updateSessionRunSnapshot(
        pending.req,
        pending.filter,
        { exitCode: 0, canceled: false, trxPath: pending.trxPath },
        summary,
        "",
        historyEntry,
      );
    }

    this.notifyRunCompleted();

    return {
      summary,
      trxPath: pending.trxPath,
      completionKind,
      historyEntry,
      filter: pending.filter,
      targets: pending.req.targets,
      stage: pending.req.stage,
      mode: pending.req.mode,
      projectDir: pending.req.projectDir,
    };
  }

  private buildDotnetRunRequest(
    req: RunRequest,
    filter: string | undefined,
    trxFileName: string,
    extraEnv?: Record<string, string>,
  ): { dotnetReq: DotnetRunRequest; preCommandMessages: string[] } {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const effective = resolveEffectiveRunFlags({
      stage: req.stage,
      runConfiguration: req.settings.runConfiguration,
      runSettingsPath: req.settings.runSettingsPath,
      byStage: req.settings.runByStage ?? {},
    });
    const resolution = resolveRunSettingsPath(workspaceRoot, effective.runSettingsPath);
    const preCommandMessages: string[] = [];
    const drySummary = this.formatReqDrySummary(req, filter);
    if (drySummary) {
      preCommandMessages.push(t(req.locale, "log.preRunDry", { summary: drySummary }));
    }
    if (
      stageRunFlagsDifferFromGlobal(
        {
          runConfiguration: req.settings.runConfiguration,
          runSettingsPath: req.settings.runSettingsPath,
        },
        effective,
      )
    ) {
      preCommandMessages.push(formatStageRunFlagsAppliedMessage(effective));
    }
    if (resolution.missingPath) {
      preCommandMessages.push(formatRunSettingsMissingMessage(resolution.missingPath));
    }
    return {
      dotnetReq: buildDotnetTestRequest({
        settings: req.settings,
        stage: req.stage,
        mode: req.mode,
        projectDir: req.projectDir,
        testTarget: req.testTarget,
        filter,
        trxFileName,
        extraEnv,
        workspaceRoot,
      }),
      preCommandMessages,
    };
  }

  private async runDebug(req: RunRequest, filter?: string): Promise<RunServiceResult> {
    if (this.debugActive) {
      return { exitCode: null, canceled: true, trxPath: "", outputBuffer: "" };
    }

    const loadedEnv = loadStageEnv(req.projectDir, req.stage);
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error("Open a workspace folder to debug tests.");
    }

    const trxFileName = createDebugTrxFileName();
    const trxPath = resolveTrxPath(req.projectDir, "TestResults", trxFileName);
    this.runStartedAt = Date.now();

    const { dotnetReq } = this.buildDotnetRunRequest(req, filter, trxFileName, {
      ...loadedEnv.vars,
      ...DEBUG_HOST_ENV,
    });
    const argsOptions = { includeXUnitRunSettings: false };
    this.rememberEffectiveCommand(req.settings.dotnetPath, buildArgs(dotnetReq, argsOptions), "debug");

    const controller = new AbortController();
    const pending: PendingDebugSession = { trxPath, req, filter, controller };
    this.pendingDebug = pending;
    this.debugActive = true;

    const attached = new Set<number>();
    let carry = "";
    const attach = async (pid: number): Promise<void> => {
      let started = false;
      try {
        started = await vscode.debug.startDebugging(
          folder,
          buildAttachDebugConfig(BDD_PILOT_DEBUG_SESSION_NAME, pid),
        );
      } catch {
        started = false;
      }
      if (!started && !controller.signal.aborted) {
        void vscode.window.showWarningMessage(t(req.locale, "toast.debugNoDebugger"));
        controller.abort();
      }
    };
    const onChunk = (chunk: string): void => {
      req.onOutput?.(sanitize(chunk));
      const scan = parseTesthostPids(chunk, carry);
      carry = scan.carry;
      for (const pid of scan.pids) {
        if (!attached.has(pid)) {
          attached.add(pid);
          void attach(pid);
        }
      }
    };

    const settle = (): void => {
      if (this.pendingDebug === pending) {
        this._onDebugEnded.fire();
      }
    };
    runDotnetTest(
      dotnetReq,
      {
        onStdout: onChunk,
        onStderr: (chunk) => req.onOutput?.(sanitize(chunk)),
        onStart: (cmd) => req.onOutput?.(`[bdd-pilot] ${sanitize(cmd)}\n`),
      },
      controller.signal,
      argsOptions,
    ).then(settle, (err: unknown) => {
      req.onOutput?.(`\n[bdd-pilot] Error: ${sanitize(String(err))}\n`);
      settle();
    });

    return {
      exitCode: null,
      canceled: false,
      trxPath,
      outputBuffer: "",
      debugStarted: true,
    };
  }

  /** Cancel while debugging: kill the `dotnet test` tree and detach Pilot sessions. */
  cancelDebug(): void {
    this.pendingDebug?.controller.abort();
    const session = vscode.debug.activeDebugSession;
    if (session?.name === BDD_PILOT_DEBUG_SESSION_NAME) {
      void vscode.debug.stopDebugging(session);
    }
  }

  private recordHistory(
    req: RunRequest,
    filter: string | undefined,
    summary: UnifiedSummary | undefined,
    trxPath: string | undefined,
    scenarios: ScenarioRunRecord[],
  ): RunHistoryEntry | undefined {
    if (!summary) {
      return undefined;
    }

    this.updateFailedTargetsFromSummary(req, summary);

    const entry: RunHistoryEntry = {
      id: `run-${Date.now()}`,
      timestamp: Date.now(),
      stage: req.stage,
      mode: req.mode,
      scopeLabel: formatRunTargetScopeLabels(req.targets).join(" | "),
      filter,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      total: summary.total,
      durationMs: Date.now() - this.runStartedAt,
      scenarios,
      status: "completed",
      runKind: resolveRunKind({ debug: req.debug, runKind: req.runKind }),
      trxPath,
    };
    this.history.push(entry);
    return entry;
  }

  private recordCanceledHistory(
    req: RunRequest,
    filter: string | undefined,
    summary: UnifiedSummary | undefined,
    liveState: LiveProgressState,
    trxPath: string | undefined,
    scenarioRecords: ScenarioRunRecord[],
  ): RunHistoryEntry | undefined {
    const hasSummary = !!summary && summary.total > 0;
    const hasLive = liveState.completed > 0;
    if (!hasSummary && !hasLive) {
      return undefined;
    }

    const scenarios = hasSummary ? scenarioRecords : [];
    const passed = hasSummary ? summary!.passed : liveState.passed;
    const failed = hasSummary ? summary!.failed : liveState.failed;
    const skipped = hasSummary ? summary!.skipped : liveState.skipped;
    const total = hasSummary ? summary!.total : liveState.completed;

    const entry: RunHistoryEntry = {
      id: `run-cancel-${Date.now()}`,
      timestamp: Date.now(),
      stage: req.stage,
      mode: req.mode,
      scopeLabel: formatRunTargetScopeLabels(req.targets).join(" | "),
      filter,
      passed,
      failed,
      skipped,
      total,
      durationMs: Date.now() - this.runStartedAt,
      scenarios,
      status: "canceled",
      runKind: resolveRunKind({ debug: req.debug, runKind: req.runKind }),
      trxPath,
    };
    this.history.push(entry);
    return entry;
  }

  private buildScenarioRecords(req: RunRequest, summary: UnifiedSummary): ScenarioRunRecord[] {
    return sanitizeScenarioRecords(
      matchScenarioRecords(req.targets, summary, req.domains ?? []),
    );
  }

  private updateFailedTargetsFromSummary(req: RunRequest, summary: UnifiedSummary): void {
    const failedTargets: RunTarget[] = [];
    for (const r of summary.results) {
      if (r.outcome !== "failed") {
        continue;
      }
      const match = matchRunTarget(req.targets, r.testName, req.domains ?? []);
      if (match) {
        failedTargets.push(match.target);
      }
    }

    if (failedTargets.length > 0) {
      this.lastFailedTargets = failedTargets;
    }

    const failedResults = summary.results.filter((r) => r.outcome === "failed");
    if (failedResults.length > 0) {
      this.lastFailedFilter = failedResults
        .map((r) => {
          const match = matchRunTarget(req.targets, r.testName, req.domains ?? []);
          if (match) {
            const clause = buildFilter(match.target, req.settings.filterMapping);
            if (clause) {
              return clause;
            }
          }
          return `FullyQualifiedName~${shortTestName(r.testName)}`;
        })
        .filter((clause, i, arr) => arr.indexOf(clause) === i)
        .join("|");
    } else {
      this.lastFailedFilter = undefined;
    }
  }

  buildFailureMessage(projectDir: string, errorMessage?: string): vscode.TestMessage {
    const evidence = findRecentEvidence(projectDir, this.runStartedAt - 5000);
    const parts: string[] = [];
    if (errorMessage) {
      parts.push(sanitize(errorMessage));
    }
    if (evidence.length > 0) {
      parts.push("\n--- Evidence (recent) ---");
      for (const e of evidence) {
        parts.push(`• ${e.kind}: ${e.label}`);
      }
    }

    const msg = new vscode.TestMessage(parts.join("\n"));
    const primary = evidence.find((e) => e.kind === "screenshot" || e.kind === "trace");
    if (primary) {
      msg.location = new vscode.Location(
        vscode.Uri.file(primary.absolutePath),
        new vscode.Position(0, 0),
      );
    }
    return msg;
  }

  private updateFailedRunSnapshot(
    req: RunRequest,
    filter: string | undefined,
    result: { exitCode: number | null; canceled: boolean; trxPath: string },
    summary: UnifiedSummary | undefined,
    outputBuffer: string,
    historyEntry?: RunHistoryEntry,
  ): void {
    if (result.canceled || !summary) {
      return;
    }
    if (result.exitCode === 0 && summary.failed === 0) {
      this.lastFailedRunSnapshot = undefined;
      try {
        clearLastFailureArtifact(req.projectDir);
      } catch {
        // P3.8 — artifact cleanup must not fail the run
      }
      return;
    }

    const failedScenarios =
      historyEntry?.scenarios
        .filter((s) => s.outcome === "failed")
        .map((s) => ({
          featurePath: s.featurePath,
          scenarioName: s.scenarioName,
          errorMessage: s.errorMessage,
        })) ?? [];

    const evidence = findRecentEvidence(req.projectDir, this.runStartedAt - 5000).map((e) => ({
      kind: e.kind,
      path: e.absolutePath,
    }));

    this.lastFailedRunSnapshot = {
      timestamp: Date.now(),
      stage: req.stage,
      mode: req.mode,
      filter,
      scopeLabels: formatRunTargetScopeLabels(req.targets),
      projectDir: req.projectDir,
      testTarget: req.testTarget,
      exitCode: result.exitCode,
      summary: {
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        total: summary.total,
        source: summary.source,
      },
      outputForAnalysis: outputBuffer,
      failedScenarios,
      evidence,
      trxPath: result.trxPath
        ? path.relative(req.projectDir, result.trxPath).split(path.sep).join("/")
        : undefined,
      trxSummary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        results: summary.results,
      },
    };

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const artifactResult = writeLastFailureArtifact({
      snapshot: this.lastFailedRunSnapshot,
      workspaceRoot,
    });
    if (!artifactResult.written && artifactResult.error) {
      console.warn(`[bdd-pilot] last failure artifact: ${artifactResult.error}`);
    }
  }

  private updateSessionRunSnapshot(
    req: RunRequest,
    filter: string | undefined,
    result: { exitCode: number | null; canceled: boolean; trxPath: string },
    summary: UnifiedSummary | undefined,
    outputBuffer: string,
    historyEntry?: RunHistoryEntry,
    liveState?: LiveProgressState,
  ): void {
    if (result.canceled) {
      const hasSummary = !!summary && summary.total > 0;
      const hasLive = (liveState?.completed ?? 0) > 0;
      if (!hasSummary && !hasLive) {
        return;
      }
    } else if (!summary) {
      return;
    }

    const runSummary = summary
      ? {
          passed: summary.passed,
          failed: summary.failed,
          skipped: summary.skipped,
          total: summary.total,
          source: summary.source,
        }
      : {
          passed: liveState!.passed,
          failed: liveState!.failed,
          skipped: liveState!.skipped,
          total: liveState!.completed,
        };

    const failedScenarios =
      historyEntry?.scenarios
        .filter((s) => s.outcome === "failed")
        .map((s) => ({
          featurePath: s.featurePath,
          scenarioName: s.scenarioName,
          errorMessage: s.errorMessage,
        })) ?? [];

    const evidence = findRecentEvidence(req.projectDir, this.runStartedAt - 5000).map((e) => ({
      kind: e.kind,
      path: e.absolutePath,
    }));

    this.lastRunSnapshot = buildSessionRunSnapshot({
      timestamp: Date.now(),
      stage: req.stage,
      mode: req.mode,
      filter,
      scopeLabels: formatRunTargetScopeLabels(req.targets),
      projectDir: req.projectDir,
      testTarget: req.testTarget,
      exitCode: result.exitCode,
      status: result.canceled ? "canceled" : "completed",
      summary: runSummary,
      failedScenarios,
      evidence,
      trxPath: toAbsoluteTrxPath(result.trxPath),
      outputBuffer,
      analyzeOptions: {
        ...req.analyzeOptions,
        trxSummary: summary
          ? {
              total: summary.total,
              passed: summary.passed,
              failed: summary.failed,
              skipped: summary.skipped,
              results: summary.results,
            }
          : req.analyzeOptions?.trxSummary,
      },
    });
  }

  private notifyRunCompleted(): void {
    this._onCompleteRun.fire();
  }

  private async checkStageConfirmation(
    req: RunRequest,
  ): Promise<"proceed" | "declined" | "denied"> {
    const decision = evaluateRun(req.stage, req.settings.requireConfirmationForStages, {
      allowProductionRuns: req.settings.allowProductionRuns,
    });
    if (decision.denied) {
      const message = t(req.locale, decision.messageKey ?? "envGuard.prodBlocked");
      void vscode.window.showWarningMessage(message);
      return "denied";
    }
    if (!decision.requiresConfirmation || !decision.messageKey) {
      return "proceed";
    }

    const message = t(req.locale, decision.messageKey, { stage: req.stage });
    const primaryAction = req.debug
      ? t(req.locale, "action.debug")
      : t(req.locale, "action.run");
    const detail = this.formatReqDrySummary(req, this.resolveDotnetFilter(req));
    const choice = await vscode.window.showWarningMessage(
      message,
      detail ? { modal: true, detail } : { modal: true },
      primaryAction,
    );
    return choice === primaryAction ? "proceed" : "declined";
  }

  private resolveDotnetFilter(req: RunRequest): string | undefined {
    return resolveExecutionFilter({
      rawFilter: req.rawFilter,
      targets: req.targets,
      filterMapping: req.settings.filterMapping,
    });
  }

  private formatReqDrySummary(req: RunRequest, filter: string | undefined): string | undefined {
    return formatPreRunDrySummary(req.locale, {
      estimatedCount: req.totalExpected,
      filter,
      scopeLabel: req.rawFilter?.trim()
        ? undefined
        : formatRunTargetScopeLabels(
            req.targets.length > 0 ? req.targets : [{ kind: "all" }],
          ).join(" | "),
    });
  }

  private async checkBindingGate(req: RunRequest): Promise<boolean> {
    const mode: BindingGateMode = req.bindingGate ?? "off";
    if (mode === "off") {
      return true;
    }

    const locations = collectStepsForRunScope(req.targets, req.domains ?? [], req.rawFilter);
    if (locations.length === 0) {
      return true;
    }

    const guardian = await tryGetGuardianResolveStep();
    if (guardian.kind === "skip") {
      this.logBindingGateSkipped(req, guardian.reason);
      return true;
    }

    const { unboundIssues, ambiguousIssues } = evaluateBindingGate(
      locations,
      guardian.resolveStep,
    );

    if (shouldLogAmbiguousIssues(ambiguousIssues)) {
      this.logAmbiguousBindingIssues(req, ambiguousIssues);
      if (unboundIssues.length === 0) {
        req.onOutput?.(`${t(req.locale, "bindingGate.ambiguousContinue")}\n`);
      }
    }

    if (!shouldPromptForUnboundIssues(unboundIssues)) {
      return true;
    }

    const ux = resolveBindingGateUx(mode, unboundIssues, ambiguousIssues);
    const promptKind = resolveUnboundPromptKind(ux);
    if (!promptKind) {
      return true;
    }

    const message = formatBindingGateUnboundPrompt(req.locale, unboundIssues, {
      preflightTitle: true,
    });
    if (promptKind === "warn-non-modal") {
      const runAnyway = t(req.locale, "bindingGate.runAnyway");
      const cancel = t(req.locale, "bindingGate.cancel");
      const choice = await vscode.window.showWarningMessage(
        message,
        { modal: false },
        runAnyway,
        cancel,
      );
      return choice === runAnyway;
    }

    const ok = t(req.locale, "bindingGate.ok");
    await vscode.window.showWarningMessage(message, { modal: true }, ok);
    return false;
  }

  private logAmbiguousBindingIssues(req: RunRequest, ambiguousIssues: BindingGateIssue[]): void {
    const header = t(req.locale, "bindingGate.outputHeader");
    const body = formatBindingGateAmbiguousOutput(req.locale, ambiguousIssues);
    req.onOutput?.(`\n${header}\n${body}\n`);
  }

  private logBindingGateSkipped(req: RunRequest, reason: GuardianSkipReason): void {
    const reasonText = t(req.locale, `bindingGate.skipReason.${reason}`);
    const line = t(req.locale, "bindingGate.skipped", { reason: reasonText });
    req.onOutput?.(`\n[bdd-pilot] ${line}\n`);
  }
}

/** History and failure snapshots are persisted or re-read later. Keep parser text raw until this copy. */
function sanitizeStoredError(message: string | undefined): string | undefined {
  if (message === undefined) {
    return undefined;
  }
  return sanitize(message);
}

function sanitizeScenarioRecords(records: ScenarioRunRecord[]): ScenarioRunRecord[] {
  return records.map((record) => ({
    ...record,
    errorMessage: sanitizeStoredError(record.errorMessage),
  }));
}

function shortTestName(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] ?? fqn;
}

function toAbsoluteTrxPath(trxPath: string | undefined): string | undefined {
  if (!trxPath) {
    return undefined;
  }
  return path.isAbsolute(trxPath) ? trxPath : path.resolve(trxPath);
}
