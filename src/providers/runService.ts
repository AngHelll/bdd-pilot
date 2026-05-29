import * as vscode from "vscode";
import { loadStageEnv } from "../core/config/envFile";
import { MODE_PROFILES, ParallelismMode, RunnerSettings, Stage } from "../core/config/types";
import { FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { findRecentEvidence } from "../core/results/evidence";
import { loadRunResults, UnifiedSummary } from "../core/results/resultLoader";
import {
  RunHistoryEntry,
  ScenarioRunRecord,
  trimHistory,
} from "../core/results/runHistory";
import { matchesScenario } from "../core/results/trxParser";
import { RunTarget, buildCombinedFilter } from "../core/runner/filterBuilder";
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
  debug?: boolean;
  signal?: AbortSignal;
  onOutput?: (chunk: string) => void;
  onStart?: (cmd: string) => void;
}

export interface RunServiceResult {
  exitCode: number | null;
  canceled: boolean;
  trxPath: string;
  summary?: UnifiedSummary;
  outputBuffer: string;
  historyEntry?: RunHistoryEntry;
}

const HISTORY_MAX = 50;

export class RunService {
  private readonly _onHistory = new vscode.EventEmitter<RunHistoryEntry[]>();
  readonly onHistoryChanged = this._onHistory.event;

  private history: RunHistoryEntry[] = [];
  private lastFailedTargets: RunTarget[] = [];
  private lastFailedFilter: string | undefined;
  private runStartedAt = 0;

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

  setHistory(entries: RunHistoryEntry[]): void {
    this.history = entries;
    this._onHistory.fire(this.history);
  }

  async run(req: RunRequest): Promise<RunServiceResult> {
    const decision = evaluateRun(req.stage, req.settings.requireConfirmationForStages);
    if (decision.requiresConfirmation) {
      const choice = await vscode.window.showWarningMessage(
        decision.message,
        { modal: true },
        req.debug ? "Debug" : "Run",
      );
      if (choice !== "Run" && choice !== "Debug") {
        return { exitCode: null, canceled: true, trxPath: "", outputBuffer: "" };
      }
    }

    const filter =
      req.rawFilter?.trim() ||
      (req.targets.length === 0 || req.targets.some((t) => t.kind === "all")
        ? undefined
        : buildCombinedFilter(req.targets));

    if (req.debug) {
      return this.runDebug(req, filter);
    }

    const loadedEnv = loadStageEnv(req.projectDir, req.stage);
    const trxFileName = `bdd-pilot-${Date.now()}.trx`;
    this.runStartedAt = Date.now();

    let buffer = "";
    const capture = (chunk: string): string => {
      const clean = sanitize(chunk);
      buffer += clean;
      req.onOutput?.(clean);
      return clean;
    };

    const result = await runDotnetTest(
      {
        dotnetPath: req.settings.dotnetPath,
        projectDir: req.projectDir,
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
    const historyEntry = this.recordHistory(req, filter, summary, result.canceled);
    if (historyEntry) {
      this.history = trimHistory(this.history, HISTORY_MAX);
      this._onHistory.fire(this.history);
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

  private async runDebug(req: RunRequest, filter?: string): Promise<RunServiceResult> {
    const loadedEnv = loadStageEnv(req.projectDir, req.stage);
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      throw new Error("Open a workspace folder to debug tests.");
    }

    const args = ["test"];
    if (filter) {
      args.push("--filter", filter);
    }

    const config: vscode.DebugConfiguration = {
      type: "coreclr",
      name: "BDD Pilot Debug",
      request: "launch",
      program: req.settings.dotnetPath,
      args,
      cwd: req.projectDir,
      env: { ...process.env, ...loadedEnv.vars, STAGE: req.stage },
      console: "integratedTerminal",
    };

    req.onOutput?.(`[bdd-pilot] Starting debugger: ${req.settings.dotnetPath} ${args.join(" ")}\n`);
    await vscode.debug.startDebugging(folder, config);

    return { exitCode: null, canceled: false, trxPath: "", outputBuffer: "" };
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
          failedTargets.push({
            kind: "scenario",
            feature: match.feature,
            scenario: match.scenario,
          });
        }
      }
    }

    if (failedTargets.length > 0) {
      this.lastFailedTargets = failedTargets;
    }

    const failedResults = summary.results.filter((r) => r.outcome === "failed");
    if (failedResults.length > 0) {
      this.lastFailedFilter = failedResults
        .map((r) => `FullyQualifiedName~${shortTestName(r.testName)}`)
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
}

function matchTarget(
  targets: RunTarget[],
  testName: string,
): { feature: FeatureInfo; scenario: ScenarioInfo } | undefined {
  for (const t of targets) {
    if (t.kind === "scenario" && matchesScenario(testName, t.scenario.name)) {
      return { feature: t.feature, scenario: t.scenario };
    }
  }
  for (const t of targets) {
    if (t.kind === "feature") {
      for (const s of t.feature.scenarios) {
        if (matchesScenario(testName, s.name)) {
          return { feature: t.feature, scenario: s };
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
