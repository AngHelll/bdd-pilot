import * as vscode from "vscode";
import { buildDashboardActionsViewModel } from "./core/results/dashboardActions";
import { buildPilotSummaryViewModel, PilotSummaryViewModel } from "./core/results/pilotSummaryViewModel";
import { getLastMappingReport } from "./core/results/lastMappingReport";
import { TREE_SEARCH_WORKSPACE_KEY } from "./core/gherkin/treeSearch";
import { resolveFirstStoreFailureSnippet } from "./core/results/storeFailureFeedback";
import { summarizeOutcomeStore } from "./core/results/outcomeStoreSummary";
import { RehydrateNotice } from "./core/results/rehydrateNotice";
import { RunHistoryEntry } from "./core/results/runHistory";
import { createPilotRunApi, PilotRunApiV1 } from "./api";
import { RunTarget } from "./core/runner/filterBuilder";
import { LiveProgressState } from "./core/runner/liveProgress";
import { pickPrimaryDiagnostic } from "./core/diagnostics/primaryDiagnostic";
import { resolveDashboardPrimaryDiagnostic } from "./core/results/dashboardDiagnostic";
import { PostRunFeedbackRequest } from "./core/feedback/postRunFeedback";
import { UnifiedSummary } from "./core/results/resultLoader";
import { ParallelismMode, Stage } from "./core/config/types";
import { resolveStageEnvFileStatus } from "./core/config/envFile";
import {
  formatEffectiveRunFlagsParts,
  resolveEffectiveRunFlags,
} from "./core/runner/stageRunFlags";
import { listDotnetTests } from "./core/runner/listTests";
import { registerFeatureCodeLens } from "./providers/codeLensProvider";
import { DashboardContext, DashboardPanel } from "./providers/dashboardPanel";
import { LocaleService } from "./providers/localeService";
import { ProfileStore } from "./providers/profileStore";
import { RunService } from "./providers/runService";
import { StatusBar } from "./providers/statusBar";
import { TestTreeProvider, readTreeGroupBy } from "./providers/testTreeProvider";
import { OutcomeStore } from "./providers/outcomeStore";
import { createManagedController, buildRerunFailedFilter } from "./providers/testController";
import { createDashboardCommands } from "./activation/dashboardCommands";
import {
  readAiSettings,
  readAnalyzeOptions,
  readBindingGate,
  readSettings,
  readStatusBarDisplay,
  readStoredMode,
  readStoredStage,
} from "./activation/extensionSettings";
import { createCopyFailureContextForAi, createPostRunHandlers } from "./activation/postRun";
import { createProjectHub } from "./activation/projectHub";
import { registerExtensionCommands } from "./activation/registerCommands";
import { createRehydrateHandlers } from "./activation/rehydrate";
import { createRunExecutor } from "./activation/runExecution";
import { registerMcpServerProvider } from "./activation/mcpServerProvider";
import { HISTORY_KEY } from "./activation/storageKeys";

export function activate(context: vscode.ExtensionContext): PilotRunApiV1 {
  const output = vscode.window.createOutputChannel("BDD Pilot");
  const localeService = new LocaleService();
  const tr = (key: Parameters<LocaleService["tr"]>[0], params?: Parameters<LocaleService["tr"]>[1]) =>
    localeService.tr(key, params);
  const statusBar = new StatusBar();
  const profileStore = new ProfileStore(context);
  const dashboard = new DashboardPanel();

  let currentStage: Stage = readStoredStage(context) ?? readSettings().defaultStage;
  let currentMode: ParallelismMode = readStoredMode(context) ?? readSettings().defaultMode;
  let activeRun: AbortController | undefined;
  let activeLiveProgress: LiveProgressState | undefined;
  let progressSummaryRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  const runService = new RunService(() =>
    context.workspaceState.get<RunHistoryEntry[]>(HISTORY_KEY, []),
  );
  const outcomeStore = new OutcomeStore();
  let rehydrateNotice: RehydrateNotice | undefined;

  const scheduleProgressSummaryRefresh = (): void => {
    if (progressSummaryRefreshTimer) {
      return;
    }
    progressSummaryRefreshTimer = setTimeout(() => {
      progressSummaryRefreshTimer = undefined;
      treeProvider.refreshPilotSummary();
    }, 120);
  };

  const clearActiveLiveProgress = (): void => {
    activeLiveProgress = undefined;
    if (progressSummaryRefreshTimer) {
      clearTimeout(progressSummaryRefreshTimer);
      progressSummaryRefreshTimer = undefined;
    }
  };

  // Forward refs wired before first use (activate bootstrap order).
  // eslint-disable-next-line prefer-const -- assigned once after dependent factories exist
  let projectHub!: ReturnType<typeof createProjectHub>;
  // eslint-disable-next-line prefer-const
  let rehydrate!: ReturnType<typeof createRehydrateHandlers>;
  // eslint-disable-next-line prefer-const
  let executeRun!: ReturnType<typeof createRunExecutor>;

  function buildPilotSummaryFromState(): PilotSummaryViewModel {
    const storeRollup = summarizeOutcomeStore(outcomeStore, treeProvider.getDomains());
    const topDiagnostic = pickPrimaryDiagnostic(runService.getLastRunSnapshot()?.diagnostics ?? []);
    const running = !!activeRun || runService.isDebugActive();
    const storeFailureSnippet =
      !running && !topDiagnostic
        ? resolveFirstStoreFailureSnippet(outcomeStore, treeProvider.getDomains())
        : undefined;
    return buildPilotSummaryViewModel({
      storeRollup,
      storeNonEmpty: !outcomeStore.isEmpty(),
      lastHistory: runService.getHistory().at(-1),
      rehydrateNotice,
      running,
      debugging: runService.isDebugActive() && !activeRun,
      emptyKind: treeProvider.getEmptyKind(),
      searchQuery: treeProvider.getSearchQuery() || undefined,
      topDiagnostic,
      storeFailureSnippet,
      liveProgress: activeLiveProgress,
      unmappedCount: getLastMappingReport()?.unmapped,
    });
  }

  const updateSearchContext = (): void => {
    const active = treeProvider.isSearchActive();
    const hasMatches = treeProvider.hasFilteredRunnableLeaves();
    void vscode.commands.executeCommand("setContext", "bddPilot.searchActive", active);
    void vscode.commands.executeCommand(
      "setContext",
      "bddPilot.searchHasMatches",
      active && hasMatches,
    );
  };

  const updateTreeGroupByContext = (): void => {
    void vscode.commands.executeCommand("setContext", "bddPilot.treeGroupBy", readTreeGroupBy());
  };

  const refreshPilotSurfaces = () => {
    const locale = localeService.getLocale();
    const summary = buildPilotSummaryFromState();
    treeProvider.refreshPilotSummary();
    dashboard.update(runService.getHistory(), locale, buildDashboardContext(summary));
  };

  const onSearchQueryChanged = (displayQuery: string): void => {
    void context.workspaceState.update(TREE_SEARCH_WORKSPACE_KEY, displayQuery);
    updateSearchContext();
    refreshPilotSurfaces();
  };

  const treeProvider = new TestTreeProvider(
    () => projectHub.getDiscoveryRoot(),
    outcomeStore,
    () => localeService.getLocale(),
    buildPilotSummaryFromState,
    onSearchQueryChanged,
  );
  const treeView = vscode.window.createTreeView("bddPilot.tests", {
    treeDataProvider: treeProvider,
  });
  treeView.message = undefined;

  let lastExecutionFeedbackKey: string | undefined;

  const buildDashboardContext = (summary = buildPilotSummaryFromState()): DashboardContext => {
    const settings = readSettings();
    const sessionSnapshot = runService.getLastFailedRunSnapshot();
    return {
      lastKnown: summary.lastKnown,
      rehydrateNotice: summary.rehydrateNotice,
      primaryDiagnostic: resolveDashboardPrimaryDiagnostic(
        summary.running,
        runService.getLastRunSnapshot()?.diagnostics,
      ),
      actions: buildDashboardActionsViewModel({
        history: runService.getHistory(),
        sessionSnapshot,
        sessionRerunFilter: buildRerunFailedFilter(runService, settings.filterMapping),
        domains: treeProvider.getDomains(),
        filterMapping: settings.filterMapping,
        aiEnabled: readAiSettings().enabled,
      }),
    };
  };

  const persistHistory = () => {
    rehydrateNotice = undefined;
    void context.workspaceState.update(HISTORY_KEY, runService.getHistory());
    refreshPilotSurfaces();
  };

  runService.onHistoryChanged(() => persistHistory());

  const FEATURE_ENRICH_DEBOUNCE_MS = 2000;
  let enrichTheoryTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelScheduledEnrich = () => {
    if (enrichTheoryTimer !== undefined) {
      clearTimeout(enrichTheoryTimer);
      enrichTheoryTimer = undefined;
    }
  };

  const refreshTreeSurfaces = () => {
    treeProvider.refresh();
    managed.refresh();
  };

  // eslint-disable-next-line prefer-const
  let managed!: ReturnType<typeof createManagedController>;

  const enrichTheoryRows = async (signal?: AbortSignal): Promise<void> => {
    const ctx = projectHub.getProjectContext();
    if (!ctx) {
      return;
    }
    const settings = readSettings();
    const enriched = await treeProvider.enrichTheoryRows(
      () =>
        listDotnetTests(
          {
            dotnetPath: settings.dotnetPath,
            projectDir: ctx.projectDir,
            testTarget: ctx.testTarget,
          },
          signal,
        ),
      signal,
    );
    if (enriched) {
      managed.refresh();
    }
  };

  function refreshAll(immediateEnrich = true) {
    refreshTreeSurfaces();
    if (immediateEnrich) {
      cancelScheduledEnrich();
      void enrichTheoryRows();
    } else {
      scheduleEnrichTheoryRows();
    }
  }

  const scheduleEnrichTheoryRows = () => {
    cancelScheduledEnrich();
    enrichTheoryTimer = setTimeout(() => {
      enrichTheoryTimer = undefined;
      void enrichTheoryRows();
    }, FEATURE_ENRICH_DEBOUNCE_MS);
  };

  const refreshUi = () => {
    const ctx = projectHub.getProjectContext();
    const running = !!activeRun || runService.isDebugActive();
    const debugging = runService.isDebugActive() && !activeRun;
    const settings = readSettings();
    const effective = resolveEffectiveRunFlags({
      stage: currentStage,
      runConfiguration: settings.runConfiguration,
      runSettingsPath: settings.runSettingsPath,
      byStage: settings.runByStage,
    });
    const runFlagsParts = formatEffectiveRunFlagsParts(effective);
    statusBar.update(
      currentStage,
      currentMode,
      localeService.getLocale(),
      ctx?.label,
      {
        running,
        debugging,
        solutionSelected: ctx?.selectedKind === "sln",
      },
      readStatusBarDisplay(),
      ctx?.projectDir ? resolveStageEnvFileStatus(ctx.projectDir, currentStage) : undefined,
      runFlagsParts.length > 0 ? runFlagsParts.join(" · ") : undefined,
    );
    treeView.badge = running
      ? {
          value: 1,
          tooltip: tr(debugging ? "badge.debugging" : "badge.running"),
        }
      : undefined;
    void vscode.commands.executeCommand("setContext", "bddPilot.running", running);
    updateSearchContext();
    updateTreeGroupByContext();
    const feedbackKey = `${running}:${debugging}`;
    if (lastExecutionFeedbackKey !== feedbackKey) {
      lastExecutionFeedbackKey = feedbackKey;
      refreshPilotSurfaces();
    }
  };

  // eslint-disable-next-line prefer-const
  rehydrate = createRehydrateHandlers({
    context,
    output,
    tr,
    runService,
    outcomeStore,
    treeProvider,
    refreshManaged: () => managed.refresh(),
    refreshPilotSurfaces,
    getProjectContext: () => projectHub.getProjectContext(),
    isRunActive: () => !!activeRun || runService.isDebugActive(),
    getRehydrateNotice: () => rehydrateNotice,
    setRehydrateNotice: (notice) => {
      rehydrateNotice = notice;
    },
  });

  projectHub = createProjectHub({
    context,
    localeService,
    outcomeStore,
    tr,
    getStage: () => currentStage,
    setStage: (stage) => {
      currentStage = stage;
    },
    getMode: () => currentMode,
    setMode: (mode) => {
      currentMode = mode;
    },
    refreshAll,
    refreshUi,
    refreshPilotSurfaces,
    tryRehydrateOutcomes: () => rehydrate.tryRehydrateOutcomes(),
  });

  const copyFailureContextForAi = createCopyFailureContextForAi({
    context,
    runService,
    localeService,
    tr,
    getProjectContext: () => projectHub.getProjectContext(),
    isRunActive: () => !!activeRun || runService.isDebugActive(),
  });

  const postRun = createPostRunHandlers({
    context,
    output,
    localeService,
    runService,
    tr,
    copyFailureContextForAi,
  });

  const notifyPostRunFeedback = (request: PostRunFeedbackRequest) =>
    postRun.notifyPostRunFeedback(request);
  const applyRunSummaryToTree = (
    summary: UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean; rawFilter?: boolean },
  ) => rehydrate.applyRunSummaryToTree(summary, targets, options);

  managed = createManagedController({
    getProjectContext: () => projectHub.getProjectContext(),
    getStage: () => currentStage,
    getMode: () => currentMode,
    getSettings: () => readSettings(),
    output,
    runService,
    outcomeStore,
    getDomains: () => treeProvider.getDomains(),
    getTagGroups: () => treeProvider.getTagGroups(),
    getTreeGroupBy: () => readTreeGroupBy(),
    getLocale: () => localeService.getLocale(),
    getAnalyzeOptions: () => readAnalyzeOptions(localeService.getLocale()),
    getBindingGate: () => readBindingGate(),
    onResultsApplied: (summary, ctx) => {
      applyRunSummaryToTree(summary, ctx.targets, { canceled: ctx.canceled });
    },
    onPostRunFeedback: notifyPostRunFeedback,
    acquireRunLock: () => {
      if (activeRun || runService.isDebugActive()) {
        return false;
      }
      activeRun = new AbortController();
      clearActiveLiveProgress();
      refreshUi();
      return true;
    },
    releaseRunLock: () => {
      activeRun = undefined;
      clearActiveLiveProgress();
      refreshUi();
    },
    abortActiveRun: () => activeRun?.abort(),
  });

  const handleDebugSessionEnded = () => {
    const debugResult = runService.finishDebugSession();
    if (!debugResult) {
      return;
    }

    output.appendLine("\n[bdd-pilot] Debug session ended.");
    if (debugResult.summary && debugResult.summary.total > 0) {
      treeProvider.applyResults(debugResult.summary);
      managed.refresh();
      output.appendLine(
        `[bdd-pilot] Results (${debugResult.summary.source}): ${debugResult.summary.passed} passed, ${debugResult.summary.failed} failed, ${debugResult.summary.skipped} skipped (${debugResult.summary.total} total).`,
      );
    } else {
      void vscode.window.showInformationMessage(tr("toast.debugNoTrx"));
    }

    managed.finalizePendingDebugRun(debugResult.summary, debugResult.completionKind, "");
    refreshUi();
  };

  // eslint-disable-next-line prefer-const
  executeRun = createRunExecutor({
    context,
    output,
    localeService,
    runService,
    treeProvider,
    tr,
    getStage: () => currentStage,
    getMode: () => currentMode,
    getActiveRun: () => activeRun,
    setActiveRun: (controller) => {
      activeRun = controller;
    },
    clearActiveLiveProgress,
    scheduleProgressSummaryRefresh,
    setActiveLiveProgress: (state) => {
      activeLiveProgress = state;
    },
    refreshUi,
    getProjectContext: () => projectHub.getProjectContext(),
    selectProject: () => projectHub.selectProject(),
    enrichTheoryRows,
    applyRunSummaryToTree,
    notifyPostRunFeedback,
    persistHistory,
    appendRunDiagnosticsToOutput: postRun.appendRunDiagnosticsToOutput,
  });

  const dashboardCommands = createDashboardCommands({
    output,
    runService,
    treeProvider,
    tr,
    buildDashboardContext,
    copyFailureContextForAi,
    executeRun,
  });

  dashboard.setMessageHandler((command) => {
    void dashboardCommands.handleDashboardCommand(command);
  });
  dashboard.setFlakyOpenHandler((target) => {
    void dashboardCommands.openFlakyScenario(target);
  });

  const codeLens = registerFeatureCodeLens(() => localeService.getLocale());

  localeService.onDidChangeLocale(() => {
    refreshUi();
    refreshAll();
    codeLens.refresh();
    dashboard.refreshLocale(localeService.getLocale(), buildDashboardContext());
  });

  async function bootstrapWorkspace(): Promise<void> {
    await enrichTheoryRows();
    rehydrate.tryRehydrateOutcomes();
  }

  context.subscriptions.push(
    output,
    localeService,
    statusBar,
    { dispose: cancelScheduledEnrich },
    treeView,
    managed.controller,
    codeLens.disposable,
    ...registerExtensionCommands({
      context,
      output,
      localeService,
      profileStore,
      dashboard,
      runService,
      treeProvider,
      tr,
      getStage: () => currentStage,
      setStage: (stage) => {
        currentStage = stage;
      },
      getMode: () => currentMode,
      setMode: (mode) => {
        currentMode = mode;
      },
      getActiveRun: () => activeRun,
      abortActiveRun: () => activeRun?.abort(),
      refreshAll,
      refreshUi,
      refreshTreeSurfaces,
      scheduleEnrichTheoryRows,
      updateTreeGroupByContext,
      buildDashboardContext,
      executeRun,
      selectProject: () => projectHub.selectProject(),
      openStatusBarHub: () => projectHub.openStatusBarHub(),
      copyFailureContextForAi,
      handleDebugSessionEnded,
      cancelScheduledEnrich,
    }),
  );

  treeProvider.refresh();
  managed.refresh();
  refreshUi();
  refreshPilotSurfaces();
  const savedSearch = context.workspaceState.get<string>(TREE_SEARCH_WORKSPACE_KEY, "");
  if (savedSearch) {
    treeProvider.setSearchQuery(savedSearch);
  } else {
    updateSearchContext();
  }
  void bootstrapWorkspace();
  void projectHub.maybePromptProjectSelection();
  registerMcpServerProvider(context);

  return createPilotRunApi({
    runService,
    outcomeStore,
    isReady: () => projectHub.getResolvedProject() !== undefined,
    isRunInProgress: () => !!activeRun || runService.isDebugActive(),
    getDomains: () => treeProvider.getDomains(),
  });
}

export function deactivate(): void {
  // no-op
}
