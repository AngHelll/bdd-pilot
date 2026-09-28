import * as vscode from "vscode";
import { formatRunNotStartedLines } from "../core/bindings/runPreflight";
import { ParallelismMode, Stage } from "../core/config/types";
import { PostRunFeedbackRequest } from "../core/feedback/postRunFeedback";
import { resolveRunKind, RunKind } from "../core/results/runHistory";
import { RunTarget, buildCombinedFilter } from "../core/runner/filterBuilder";
import { formatRunCanceledLine } from "../core/runner/processTree";
import {
  detectBuildFileLock,
  formatBuildFileLockHintLine,
} from "../core/runner/buildFileLockHint";
import {
  DISCOVER_LIST_TIMEOUT_MS,
  classifyDiscoverTime,
  formatDiscoverTimeLine,
  shouldProbeDiscoverList,
} from "../core/runner/discoverTime";
import { listDotnetTestsWithBudget } from "../core/runner/listTests";
import {
  formatProgressMessage,
  LiveProgressState,
  PROGRESS_QUIET_AFTER_MS,
  TestCompletionEvent,
} from "../core/runner/liveProgress";
import { estimateTestCount } from "../core/runner/runEstimate";
import { MessageKey } from "../core/i18n";
import { ProjectContext } from "../providers/testController";
import { LocaleService } from "../providers/localeService";
import { RunService } from "../providers/runService";
import { TestTreeProvider, readTreeGroupBy } from "../providers/testTreeProvider";
import {
  readAnalyzeOptions,
  readBindingGate,
  readSettings,
  readSuggestScopedWhenLarge,
} from "./extensionSettings";
import { writeRunTerminal } from "./runTerminal";
import { resolveRunTargets } from "./runTargets";
import { promptScopedRunNudgeIfNeeded } from "./scopedRunNudgeUi";

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
      // Identity-safe: do not clear a newer run started after force-unlock.
      if (deps.getActiveRun() === controller) {
        deps.setActiveRun(undefined);
        deps.clearActiveLiveProgress();
        deps.refreshUi();
      }
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

    const domains = deps.treeProvider.getDomains();
    let runTargets = opts?.rawFilter ? [] : resolveRunTargets(target);
    let totalExpected =
      opts?.rawFilter || opts?.debug
        ? undefined
        : estimateTestCount(runTargets, project.discoveryRoot, domains);

    const isPlainRunAll =
      !opts?.rawFilter &&
      !opts?.debug &&
      runTargets.length === 1 &&
      runTargets[0]?.kind === "all";

    if (isPlainRunAll) {
      const nudge = await promptScopedRunNudgeIfNeeded({
        tr: deps.tr,
        suggestEnabled: readSuggestScopedWhenLarge(),
        groupBy: readTreeGroupBy(),
        domains,
        tagGroups: deps.treeProvider.getTagGroups(),
        estimatedLeafCount: totalExpected ?? 0,
      });
      if (nudge.action === "cancel") {
        releaseRunLock();
        return;
      }
      if (nudge.action === "scoped") {
        runTargets = resolveRunTargets(nudge.target);
        totalExpected = estimateTestCount(runTargets, project.discoveryRoot, domains);
      }
    }

    if (totalExpected === 0) {
      const emptyLine = formatDiscoverTimeLine(classifyDiscoverTime({ gherkin: 0 }));
      if (emptyLine) {
        writeRunTerminal(`[bdd-pilot] ${emptyLine}\n`);
      }
      void vscode.window.showInformationMessage(deps.tr("toast.discoverEmptyScope"));
      releaseRunLock();
      return;
    }

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
      totalExpected,
      bindingGate: readBindingGate(),
      domains: deps.treeProvider.getDomains(),
      analyzeOptions: readAnalyzeOptions(locale),
      onOutput: (chunk) => {
        writeRunTerminal(chunk);
      },
    });
    if (!preflight.proceed) {
      releaseRunLock();
      for (const line of formatRunNotStartedLines(locale, preflight.reason)) {
        writeRunTerminal(`${line}\n`);
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
        let holdListedZeroNotice = false;
        let quietTimer: ReturnType<typeof setTimeout> | undefined;

        const clearQuietTimer = (): void => {
          if (quietTimer) {
            clearTimeout(quietTimer);
            quietTimer = undefined;
          }
        };

        const armQuietTimer = (): void => {
          if (opts?.debug) {
            return;
          }
          clearQuietTimer();
          quietTimer = setTimeout(() => {
            quietTimer = undefined;
            if (holdListedZeroNotice || !lastProgressState) {
              return;
            }
            const state: LiveProgressState = {
              ...lastProgressState,
              quietMs: PROGRESS_QUIET_AFTER_MS,
            };
            const message = formatProgressMessage(state, deps.localeService.getLocale());
            if (message === lastMessage) {
              return;
            }
            lastProgressState = state;
            lastMessage = message;
            deps.setActiveLiveProgress(state);
            deps.scheduleProgressSummaryRefresh();
            progress.report({ message });
          }, PROGRESS_QUIET_AFTER_MS);
        };

        const onProgress = (state: LiveProgressState, event?: TestCompletionEvent) => {
          lastProgressState = state;
          if (!opts?.debug) {
            deps.setActiveLiveProgress(state);
            deps.scheduleProgressSummaryRefresh();
          }
          if (holdListedZeroNotice && !event) {
            return;
          }
          if (event) {
            holdListedZeroNotice = false;
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
            armQuietTimer();
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
              writeRunTerminal(`\n${formatRunCanceledLine({ forced: false })}\n`);
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
            writeRunTerminal("\n");
            if (!opts?.rawFilter) {
              const scopeTargets = runTargets.length > 0 ? runTargets : [{ kind: "all" as const }];
              deps.treeProvider.clearResultsForRunScope(scopeTargets);
            }
          }

          const runLocale = deps.localeService.getLocale();
          let fileLockHinted = false;

          const scopedFilter =
            opts?.rawFilter?.trim() ||
            (runTargets.length === 0 || runTargets.some((t) => t.kind === "all")
              ? undefined
              : buildCombinedFilter(runTargets, settings.filterMapping));
          if (
            shouldProbeDiscoverList({
              targets: runTargets,
              filter: scopedFilter,
              rawFilter: Boolean(opts?.rawFilter),
              debug: Boolean(opts?.debug),
            })
          ) {
            let listed: number | undefined;
            try {
              const names = await listDotnetTestsWithBudget(
                {
                  dotnetPath: settings.dotnetPath || "dotnet",
                  projectDir: project.projectDir,
                  testTarget: project.testTarget,
                  filter: scopedFilter,
                },
                DISCOVER_LIST_TIMEOUT_MS,
                controller.signal,
              );
              listed = names.length;
            } catch {
              listed = undefined;
            }
            const classified = classifyDiscoverTime({ listed, gherkin: totalExpected });
            if (classified.kind === "zero") {
              const listedZeroMessage = deps.tr("toast.discoverListedZero");
              lastMessage = listedZeroMessage;
              holdListedZeroNotice = true;
              progress.report({ message: listedZeroMessage });
            }
          }

          const writeRunStream = (chunk: string): void => {
            if (opts?.debug) {
              return;
            }
            if (!fileLockHinted && detectBuildFileLock(chunk)) {
              fileLockHinted = true;
              writeRunTerminal(`${formatBuildFileLockHintLine()}\n`);
            }
            writeRunTerminal(chunk);
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
            onOutput: writeRunStream,
          });

          if (result.canceled) {
            writeRunTerminal(`${formatRunCanceledLine({ forced: !!result.forced })}\n`);
            if (result.summary) {
              deps.applyRunSummaryToTree(result.summary, runTargets, { canceled: true });
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

          if (result.summary) {
            deps.applyRunSummaryToTree(result.summary, runTargets, { rawFilter: !!opts?.rawFilter });
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
          writeRunTerminal(`\n[bdd-pilot] Error: ${String(err)}\n`);
          deps.notifyPostRunFeedback({
            canceled: false,
            debug: false,
            outputBuffer: String(err),
            exitCode: 1,
            fallbackMessage: `BDD Pilot: ${String(err)}`,
          });
        } finally {
          clearQuietTimer();
          releaseRunLock();
        }
      },
    );
  };
}

export type RunExecutor = ReturnType<typeof createRunExecutor>;
