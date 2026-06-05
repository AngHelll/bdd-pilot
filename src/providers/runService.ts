import * as path from "path";
import * as vscode from "vscode";
import {
  formatRunTargetScopeLabels,
  LastRunSnapshot,
} from "../core/diagnostics/aiFailureContext";
import { classifyRunCompletion, RunCompletionKind } from "../core/diagnostics/runOutcomeClass";
import { loadStageEnv } from "../core/config/envFile";
import { MODE_PROFILES, ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { PilotLocale, t } from "../core/i18n";
import { FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { findRecentEvidence } from "../core/results/evidence";
import { loadRunResults, UnifiedSummary } from "../core/results/resultLoader";
import {
  appendTrxLoggerArgs,
  createDebugTrxFileName,
  createRunTrxFileName,
  resolveTrxPath,
} from "../core/runner/trxArgs";
import {
  RunHistoryEntry,
  ScenarioRunRecord,
  trimHistory,
} from "../core/results/runHistory";
import { matchesScenario } from "../core/results/trxParser";
import { findOutlineExampleMatch } from "../core/results/scenarioMatch";
import { RunTarget, buildCombinedFilter, buildFilter } from "../core/runner/filterBuilder";
import { LiveProgressParser, LiveProgressState, TestCompletionEvent } from "../core/runner/liveProgress";
import { runDotnetTest } from "../core/runner/dotnetTest";
import { evaluateRun } from "../security/envGuard";
import { sanitize } from "../security/sanitizer";

export interface RunRequest {
  targets: RunTarget[];
  /** When set, bypasses target-derived filter (execution profiles). */
  rawFilter?: string;
  stage: Stage;
  mode: ParallelismMode;
  settings: RunnerSettings;
  projectDir: string;
  testTarget?: string;
  debug?: boolean;
  /** UI locale for confirmation dialogs. */
  locale: PilotLocale;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  onStart?: (cmd: string) => void;
  /** Expected test count for progress UI (outline rows included). */
  totalExpected?: number;
  /** Fired as stdout is parsed; includes per-test completion events. */
  onProgress?: (state: LiveProgressState, event?: TestCompletionEvent) => void;
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

  private history: RunHistoryEntry[] = [];
  private lastFailedTargets: RunTarget[] = [];
  private lastFailedFilter: string | undefined;
  private lastFailedRunSnapshot: LastRunSnapshot | undefined;
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

  setHistory(entries: RunHistoryEntry[]): void {
    this.history = entries;
    this._onHistory.fire(this.history);
  }

  isDebugActive(): boolean {
    return this.debugActive;
  }

  async run(req: RunRequest): Promise<RunServiceResult> {
    const decision = evaluateRun(req.stage, req.settings.requireConfirmationForStages);
    if (decision.requiresConfirmation && decision.messageKey) {
      const message = t(req.locale, decision.messageKey, { stage: req.stage });
      const primaryAction = req.debug
        ? t(req.locale, "action.debug")
        : t(req.locale, "action.run");
      const choice = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        primaryAction,
      );
      if (choice !== primaryAction) {
        return { exitCode: null, canceled: true, trxPath: "", outputBuffer: "" };
      }
    }

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
      {
        dotnetPath: req.settings.dotnetPath,
        projectDir: req.projectDir,
        testTarget: req.testTarget,
        filter,
        stage: req.stage,
        mode: MODE_PROFILES[req.mode],
        resultsDir: "TestResults",
        trxFileName,
        extraEnv: loadedEnv.vars,
      },
      {
        onStart: (cmd) => {
          req.onStart?.(cmd);
          capture(`[bdd-pilot] ${sanitize(cmd)}\n`);
        },
        onStdout: capture,
        onStderr: capture,
      },
      req.signal ?? new AbortController().signal,
    );

    const summary = loadRunResults(req.projectDir, result.trxPath);
    const historyEntry = result.canceled
      ? undefined
      : this.recordHistory(req, filter, summary, false);
    if (historyEntry) {
      this.history = trimHistory(this.history, HISTORY_MAX);
      this._onHistory.fire(this.history);
    }
    if (!result.canceled) {
      this.updateFailedRunSnapshot(req, filter, result, summary, buffer, historyEntry);
    }

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
      historyEntry = this.recordHistory(pending.req, pending.filter, summary, false);
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
    }

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

    const args = ["test"];
    if (req.testTarget && /\.(csproj|sln)$/i.test(req.testTarget)) {
      args.push(req.testTarget);
    }
    if (filter) {
      args.push("--filter", filter);
    }
    appendTrxLoggerArgs(args, trxFileName);

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
    canceled: boolean,
  ): RunHistoryEntry | undefined {
    if (canceled || !summary) {
      return undefined;
    }

    const scenarios: ScenarioRunRecord[] = [];
    const failedTargets: RunTarget[] = [];

    for (const r of summary.results) {
      const match = matchTarget(req.targets, r.testName);
      if (match) {
        scenarios.push({
          featurePath: match.feature.filePath,
          scenarioLine: match.scenario.line,
          scenarioName: match.scenario.name,
          outcome: r.outcome,
          durationMs: r.durationMs,
          errorMessage: r.errorMessage,
        });
        if (r.outcome === "failed") {
          failedTargets.push(match.target);
        }
      }
    }

    if (failedTargets.length > 0) {
      this.lastFailedTargets = failedTargets;
    }

    const failedResults = summary.results.filter((r) => r.outcome === "failed");
    if (failedResults.length > 0) {
      this.lastFailedFilter = failedResults
        .map((r) => {
          const match = matchTarget(req.targets, r.testName);
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

    const entry: RunHistoryEntry = {
      id: `run-${Date.now()}`,
      timestamp: Date.now(),
      stage: req.stage,
      mode: req.mode,
      filter,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      total: summary.total,
      durationMs: Date.now() - this.runStartedAt,
      scenarios,
    };
    this.history.push(entry);
    return entry;
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
  }
}

function matchTarget(
  targets: RunTarget[],
  testName: string,
): { target: RunTarget; feature: FeatureInfo; scenario: ScenarioInfo } | undefined {
  for (const t of targets) {
    if (t.kind === "outlineRow") {
      if (
        findOutlineExampleMatch(testName, t.scenario.name, [t.example])
      ) {
        return { target: t, feature: t.feature, scenario: t.scenario };
      }
    }
  }
  for (const t of targets) {
    if (t.kind === "scenario" && matchesScenario(testName, t.scenario.name)) {
      return { target: t, feature: t.feature, scenario: t.scenario };
    }
  }
  for (const t of targets) {
    if (t.kind === "feature") {
      for (const s of t.feature.scenarios) {
        if (matchesScenario(testName, s.name)) {
          return {
            target: { kind: "scenario", feature: t.feature, scenario: s },
            feature: t.feature,
            scenario: s,
          };
        }
      }
    }
  }
  return undefined;
}

function shortTestName(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] ?? fqn;
}
