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
import { MODE_PROFILES, ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { PilotLocale, t } from "../core/i18n";
import { DomainGroup } from "../core/gherkin/model";
import { findRecentEvidence } from "../core/results/evidence";
import { loadRunResults, UnifiedSummary } from "../core/results/resultLoader";
import {
  createDebugTrxFileName,
  createRunTrxFileName,
  resolveTrxPath,
} from "../core/runner/trxArgs";
import { RunTarget, buildCombinedFilter, buildFilter } from "../core/runner/filterBuilder";
import { LiveProgressParser, LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { buildArgs, runDotnetTest, RunRequest as DotnetRunRequest } from "../core/runner/dotnetTest";
import {
  formatRunSettingsMissingMessage,
  resolveRunSettingsPath,
} from "../core/runner/runSettingsPath";
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
}

export class RunService {
  private readonly _onHistory = new vscode.EventEmitter<RunHistoryEntry[]>();
  readonly onHistoryChanged = this._onHistory.event;

  private readonly _onCompleteRun = new vscode.EventEmitter<void>();
  readonly onRunCompleted = this._onCompleteRun.event;

  private history: RunHistoryEntry[] = [];
  private lastFailedTargets: RunTarget[] = [];
  private lastFailedFilter: string | undefined;
  private lastFailedRunSnapshot: LastRunSnapshot | undefined;
  private lastRunSnapshot: SessionRunSnapshot | undefined;
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
    const filter =
      req.rawFilter?.trim() ||
      (req.targets.length === 0 || req.targets.some((t) => t.kind === "all")
        ? undefined
        : buildCombinedFilter(req.targets, req.settings.filterMapping));

    if (req.debug) {
      return this.runDebug(req, filter);
    }

    const loadedEnv = loadStageEnv(req.projectDir, req.stage);
    const trxFileName = createRunTrxFileName();
    this.runStartedAt = Date.now();
    const progressParser = new LiveProgressParser(req.totalExpected);

    const { dotnetReq, preCommandMessages } = this.buildDotnetRunRequest(
      req,
      filter,
      trxFileName,
      loadedEnv.vars,
    );

    let buffer = "";
    const capture = (chunk: string): string => {
      const clean = sanitize(chunk);
      buffer += clean;
      req.onOutput?.(clean);
      for (const event of progressParser.feed(clean)) {
        req.onProgress?.(progressParser.getState(), event);
      }
      return clean;
    };

    const result = await runDotnetTest(
      dotnetReq,
      {
        onStart: (cmd) => {
          for (const msg of preCommandMessages) {
            capture(`${msg}\n`);
          }
          req.onStart?.(cmd);
          capture(`[bdd-pilot] ${sanitize(cmd)}\n`);
        },
        onStdout: capture,
        onStderr: capture,
      },
      req.signal ?? new AbortController().signal,
    );

    const summary = loadRunResults(req.projectDir, result.trxPath);
    const liveState = progressParser.getState();
    const absoluteTrxPath = toAbsoluteTrxPath(result.trxPath);
    const historyEntry = result.canceled
      ? this.recordCanceledHistory(req, filter, summary, liveState, absoluteTrxPath)
      : this.recordHistory(req, filter, summary, absoluteTrxPath);
    if (historyEntry) {
      this.history = trimHistory(this.history, HISTORY_MAX);
      this._onHistory.fire(this.history);
    }
    if (!result.canceled) {
      this.updateFailedRunSnapshot(req, filter, result, summary, buffer, historyEntry);
    }
    this.updateSessionRunSnapshot(
      req,
      filter,
      result,
      summary,
      buffer,
      historyEntry,
      liveState,
    );
    this.notifyRunCompleted();

    return {
      exitCode: result.exitCode,
      canceled: result.canceled,
      trxPath: result.trxPath,
      summary,
      outputBuffer: buffer,
      historyEntry,
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
      canceled: false,
      summary,
      outputBuffer: "",
    });

    let historyEntry: RunHistoryEntry | undefined;
    if (summary && summary.total > 0) {
      const absoluteTrxPath = toAbsoluteTrxPath(pending.trxPath);
      historyEntry = this.recordHistory(pending.req, pending.filter, summary, absoluteTrxPath);
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
    const resolution = resolveRunSettingsPath(workspaceRoot, req.settings.runSettingsPath);
    const preCommandMessages: string[] = [];
    if (resolution.missingPath) {
      preCommandMessages.push(formatRunSettingsMissingMessage(resolution.missingPath));
    }
    const configuration = req.settings.runConfiguration.trim() || undefined;
    return {
      dotnetReq: {
        dotnetPath: req.settings.dotnetPath,
        projectDir: req.projectDir,
        testTarget: req.testTarget,
        filter,
        stage: req.stage,
        mode: MODE_PROFILES[req.mode],
        resultsDir: "TestResults",
        trxFileName,
        configuration,
        noBuild: req.settings.runNoBuild,
        settingsPath: resolution.settingsPath,
        extraEnv,
      },
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

    const { dotnetReq, preCommandMessages } = this.buildDotnetRunRequest(req, filter, trxFileName);
    const args = buildArgs(dotnetReq, { includeXUnitRunSettings: false });

    const config: vscode.DebugConfiguration = {
      type: "coreclr",
      name: BDD_PILOT_DEBUG_SESSION_NAME,
      request: "launch",
      program: req.settings.dotnetPath,
      args,
      cwd: req.projectDir,
      env: { ...process.env, ...loadedEnv.vars, STAGE: req.stage },
      console: "integratedTerminal",
    };

    this.pendingDebug = { trxPath, req, filter };
    for (const msg of preCommandMessages) {
      req.onOutput?.(`${msg}\n`);
    }
    req.onOutput?.(
      `[bdd-pilot] Starting debugger: ${req.settings.dotnetPath} ${args.join(" ")}\n`,
    );
    const started = await vscode.debug.startDebugging(folder, config);
    if (!started) {
      this.pendingDebug = undefined;
      return { exitCode: null, canceled: true, trxPath: "", outputBuffer: "" };
    }

    this.debugActive = true;
    return {
      exitCode: null,
      canceled: false,
      trxPath,
      outputBuffer: "",
      debugStarted: true,
    };
  }

  private recordHistory(
    req: RunRequest,
    filter: string | undefined,
    summary: UnifiedSummary | undefined,
    trxPath?: string,
  ): RunHistoryEntry | undefined {
    if (!summary) {
      return undefined;
    }

    const scenarios = this.buildScenarioRecords(req, summary);
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
    trxPath?: string,
  ): RunHistoryEntry | undefined {
    const hasSummary = !!summary && summary.total > 0;
    const hasLive = liveState.completed > 0;
    if (!hasSummary && !hasLive) {
      return undefined;
    }

    const scenarios = hasSummary ? this.buildScenarioRecords(req, summary!) : [];
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
    const scenarios: ScenarioRunRecord[] = [];
    for (const r of summary.results) {
      const match = matchRunTarget(req.targets, r.testName, req.domains ?? []);
      if (match) {
        scenarios.push({
          featurePath: match.feature.filePath,
          scenarioLine: match.scenario.line,
          scenarioName: match.scenario.name,
          outcome: r.outcome,
          durationMs: r.durationMs,
          errorMessage: r.errorMessage,
        });
      }
    }
    if (scenarios.length === 0) {
      for (const r of summary.results) {
        scenarios.push({
          featurePath: "",
          scenarioLine: 0,
          scenarioName: r.testName,
          outcome: r.outcome,
          durationMs: r.durationMs,
          errorMessage: r.errorMessage,
        });
      }
    }
    return scenarios;
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
      parts.push(errorMessage);
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
      analyzeOptions: req.analyzeOptions,
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
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      primaryAction,
    );
    return choice === primaryAction ? "proceed" : "declined";
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
