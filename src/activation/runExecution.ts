import * as path from "path";
import * as vscode from "vscode";
import { formatRunNotStartedLines } from "../core/bindings/runPreflight";
import { loadStageEnv } from "../core/config/envFile";
import { ParallelismMode, Stage } from "../core/config/types";
import { formatRunTargetScopeLabels } from "../core/diagnostics/aiFailureContext";
import {
  createDotnetOutputFilterState,
  flushDotnetOutputFilter,
  formatOutputSectionHeader,
  formatRunContextLine,
  processDotnetOutputChunk,
} from "../core/feedback/dotnetOutputFilter";
import { PostRunFeedbackRequest } from "../core/feedback/postRunFeedback";
import { resolveRunKind, RunKind } from "../core/results/runHistory";
import { RunTarget } from "../core/runner/filterBuilder";
import {
  formatProgressMessage,
  LiveProgressState,
  TestCompletionEvent,
} from "../core/runner/liveProgress";
import { estimateTestCount } from "../core/runner/runEstimate";
import { MessageKey } from "../core/i18n";
import { ProjectContext } from "../providers/testController";
import { LocaleService } from "../providers/localeService";
import { RunService } from "../providers/runService";
import { TestTreeProvider } from "../providers/testTreeProvider";
import {
  readAnalyzeOptions,
  readBindingGate,
  readDotnetVerbosity,
  readSettings,
} from "./extensionSettings";
import { resolveRunTargets } from "./runTargets";

export interface RunExecutionDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  localeService: LocaleService;
  runService: RunService;
  treeProvider: TestTreeProvider;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  getStage: () => Stage;
  getMode: () => ParallelismMode;
  getActiveRun: () => AbortController | undefined;
  setActiveRun: (controller: AbortController | undefined) => void;
  clearActiveLiveProgress: () => void;
  scheduleProgressSummaryRefresh: () => void;
  setActiveLiveProgress: (state: LiveProgressState | undefined) => void;
  refreshUi: () => void;
  getProjectContext: () => ProjectContext | undefined;
  selectProject: () => Promise<unknown>;
  enrichTheoryRows: (signal?: AbortSignal) => Promise<void>;
  applyRunSummaryToTree: (
    summary: import("../core/results/resultLoader").UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean; rawFilter?: boolean },
  ) => void;
  notifyPostRunFeedback: (request: PostRunFeedbackRequest) => void;
  persistHistory: () => void;
  appendRunDiagnosticsToOutput: (text: string) => void;
}

export function createRunExecutor(deps: RunExecutionDeps) {
  return async function executeRun(
    target: RunTarget | RunTarget[],
    opts?: { debug?: boolean; rawFilter?: string; runKind?: RunKind },
  ): Promise<void> {
    if (deps.getActiveRun() || deps.runService.isDebugActive()) {
      if (opts?.debug) {
        void vscode.window.showWarningMessage(
          deps.runService.isDebugActive()
            ? deps.tr("toast.debugAlreadyActive")
            : deps.tr("toast.debugWhileRunning"),
        );
      } else {
        void vscode.window.showWarningMessage(deps.tr("toast.runInProgress"));
      }
      return;
    }

    // Claim busy lock before preflight / project select so multi-click Run cannot re-enter.
    const controller = new AbortController();
    let runLockHeld = false;
    const releaseRunLock = () => {
      if (!runLockHeld) {
        return;
      }
      runLockHeld = false;
      deps.setActiveRun(undefined);
      deps.clearActiveLiveProgress();
      deps.refreshUi();
    };
    if (!opts?.debug) {
      runLockHeld = true;
      deps.setActiveRun(controller);
      deps.clearActiveLiveProgress();
      deps.refreshUi();
    }

    const settings = readSettings();
    const currentStage = deps.getStage();
    const currentMode = deps.getMode();
    if (!deps.getProjectContext()) {
      if (!(await deps.selectProject())) {
        releaseRunLock();
        return;
      }
    }
    const project = deps.getProjectContext();
    if (!project) {
      releaseRunLock();
      void vscode.window.showErrorMessage(deps.tr("toast.projectNotFound"));
      return;
    }

    const runTargets = opts?.rawFilter ? [] : resolveRunTargets(target);
    const totalExpected =
      opts?.rawFilter || opts?.debug
        ? undefined
        : estimateTestCount(runTargets, project.discoveryRoot);

    if (opts?.debug && deps.treeProvider.needsTheoryDiscovery()) {
      await deps.enrichTheoryRows();
    }

    const sessionRunKind = resolveRunKind({ debug: opts?.debug, runKind: opts?.runKind });

    const locale = deps.localeService.getLocale();
    const preflight = await deps.runService.runPreflight({
      targets: runTargets,
      rawFilter: opts?.rawFilter,
      stage: currentStage,
      mode: currentMode,
      settings,
      projectDir: project.projectDir,
      testTarget: project.testTarget,
      debug: opts?.debug,
      runKind: sessionRunKind,
      locale,
      bindingGate: readBindingGate(),
      domains: deps.treeProvider.getDomains(),
      analyzeOptions: readAnalyzeOptions(locale),
      onOutput: (chunk) => {
        deps.output.show(true);
        deps.output.append(chunk);
      },
    });
    if (!preflight.proceed) {
      releaseRunLock();
      deps.output.show(true);
      for (const line of formatRunNotStartedLines(locale, preflight.reason)) {
        deps.output.appendLine(line);
      }
      return;
    }

    const resolveRunCancelProgress = (
      lastProgressState: LiveProgressState | undefined,
    ): { completed: number; expected: number } | undefined => {
      if (lastProgressState?.totalExpected != null) {
        return {
          completed: lastProgressState.completed,
          expected: lastProgressState.totalExpected,
        };
      }
      if (totalExpected != null) {
        return { completed: 0, expected: totalExpected };
      }
      return undefined;
    };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: opts?.debug
          ? deps.tr("progress.debugging", { stage: currentStage })
          : deps.tr("progress.running", { stage: currentStage, mode: currentMode }),
        cancellable: false,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => controller.abort());

        const progressIncrement = totalExpected && totalExpected > 0 ? 100 / totalExpected : 0;
        let lastMessage = "";
        let lastProgressState: LiveProgressState | undefined;

        const onProgress = (state: LiveProgressState, event?: TestCompletionEvent) => {
          lastProgressState = state;
          if (!opts?.debug) {
            deps.setActiveLiveProgress(state);
            deps.scheduleProgressSummaryRefresh();
          }
          const message = formatProgressMessage(state, deps.localeService.getLocale());
          if (event && progressIncrement > 0) {
            lastMessage = message;
            progress.report({ message, increment: progressIncrement });
          } else if (message !== lastMessage) {
            lastMessage = message;
            progress.report({ message });
          }
          if (event) {
            deps.treeProvider.applyLiveResult(event.testName, event.outcome);
          }
        };

        try {
          if (!opts?.debug && deps.treeProvider.needsTheoryDiscovery()) {
            progress.report({ message: deps.tr("progress.discovering") });
            try {
              await deps.enrichTheoryRows(controller.signal);
            } catch {
              // list-tests canceled — handled below via signal.aborted
            }
            if (controller.signal.aborted) {
              deps.output.appendLine("\n[bdd-pilot] Run canceled.");
              deps.notifyPostRunFeedback({
                canceled: true,
                debug: false,
                outputBuffer: "",
                exitCode: null,
              });
              return;
            }
          }

          if (!opts?.debug) {
            deps.output.clear();
            deps.output.show(true);
            if (!opts?.rawFilter) {
              const scopeTargets = runTargets.length > 0 ? runTargets : [{ kind: "all" as const }];
              deps.treeProvider.clearResultsForRunScope(scopeTargets);
            }

            const loadedEnv = loadStageEnv(project.projectDir, currentStage);
            const envMissingKey = `bddPilot.envMissingNotified.${currentStage}`;
            if (loadedEnv.loadedFiles.length > 0) {
              void deps.context.workspaceState.update(envMissingKey, undefined);
              const names = loadedEnv.loadedFiles.map((f) => path.basename(f)).join(", ");
              deps.output.appendLine(
                deps.tr("log.envLoaded", {
                  files: names,
                  count: Object.keys(loadedEnv.vars).length,
                }),
              );
            } else if (!deps.context.workspaceState.get<boolean>(envMissingKey)) {
              deps.output.appendLine(deps.tr("log.envMissing", { stage: currentStage }));
              void deps.context.workspaceState.update(envMissingKey, true);
            }
          }

          const runLocale = deps.localeService.getLocale();
          const filterState = createDotnetOutputFilterState();
          const verbosity = readDotnetVerbosity();
          const scopeLabel = opts?.rawFilter
            ? opts.rawFilter
            : formatRunTargetScopeLabels(runTargets.length > 0 ? runTargets : [{ kind: "all" }]).join(
                " | ",
              );
          deps.output.appendLine(formatOutputSectionHeader(runLocale, "run"));
          deps.output.appendLine(
            formatRunContextLine(runLocale, {
              stage: currentStage,
              mode: currentMode,
              scopeLabel,
            }),
          );

          const appendFiltered = (chunk: string): void => {
            const filtered = processDotnetOutputChunk(chunk, filterState, verbosity);
            if (filtered.length > 0) {
              deps.output.append(filtered);
            }
          };

          const beginResultsSection = (): void => {
            const flushed = flushDotnetOutputFilter(filterState);
            if (flushed.length > 0) {
              deps.output.append(flushed);
            }
            deps.output.appendLine("");
            deps.output.appendLine(formatOutputSectionHeader(runLocale, "results"));
          };

          const result = await deps.runService.runExecution({
            targets: runTargets,
            rawFilter: opts?.rawFilter,
            stage: currentStage,
            mode: currentMode,
            settings,
            projectDir: project.projectDir,
            testTarget: project.testTarget,
            debug: opts?.debug,
            runKind: sessionRunKind,
            locale: runLocale,
            signal: controller.signal,
            totalExpected,
            bindingGate: readBindingGate(),
            domains: deps.treeProvider.getDomains(),
            analyzeOptions: readAnalyzeOptions(runLocale),
            onProgress,
            onOutput: appendFiltered,
          });

          if (result.canceled) {
            beginResultsSection();
            deps.output.appendLine("[bdd-pilot] Run canceled.");
            if (result.summary) {
              deps.applyRunSummaryToTree(result.summary, runTargets, { canceled: true });
              deps.output.appendLine(
                `[bdd-pilot] Partial results (${result.summary.source}): ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.total} total).`,
              );
            }
            deps.notifyPostRunFeedback({
              canceled: true,
              debug: false,
              outputBuffer: result.outputBuffer,
              exitCode: result.exitCode,
              summary: result.summary,
              cancelProgress: resolveRunCancelProgress(lastProgressState),
            });
            return;
          }

          if (opts?.debug) {
            if (result.debugStarted) {
              deps.refreshUi();
            }
            return;
          }

          beginResultsSection();
          deps.output.appendLine(`[bdd-pilot] Process exited with code ${result.exitCode}.`);
          if (result.summary) {
            deps.applyRunSummaryToTree(result.summary, runTargets, { rawFilter: !!opts?.rawFilter });
            deps.output.appendLine(
              `[bdd-pilot] Results (${result.summary.source}): ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.total} total).`,
            );
          }
          deps.notifyPostRunFeedback({
            canceled: false,
            debug: false,
            outputBuffer: result.outputBuffer,
            exitCode: result.exitCode,
            summary: result.summary,
          });
          deps.persistHistory();
        } catch (err) {
          deps.output.appendLine(`\n[bdd-pilot] Error: ${String(err)}`);
          deps.appendRunDiagnosticsToOutput(String(err));
          deps.notifyPostRunFeedback({
            canceled: false,
            debug: false,
            outputBuffer: String(err),
            exitCode: 1,
            fallbackMessage: `BDD Pilot: ${String(err)}`,
          });
        } finally {
          releaseRunLock();
        }
      },
    );
  };
}

export type RunExecutor = ReturnType<typeof createRunExecutor>;
