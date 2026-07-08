import * as path from "path";
import * as vscode from "vscode";
import { ExecutionProfile } from "./core/config/profiles";
import {
  discoveryRoot,
  expandDirectoryAmbiguity,
  listSelectableProjects,
  resolveExecutionTarget,
  resolveProject,
  ResolvedProject,
  StoredProjectSelection,
  toStoredSelection,
} from "./core/config/projectResolution";
import { discoverProjectCandidates } from "./core/config/projectLocator";
import { loadStageEnv } from "./core/config/envFile";
import { buildModeHubPickItems, buildStageHubPickItems } from "./core/config/hubPickItems";
import { readStatusBarDisplayMode, StatusBarDisplayMode } from "./core/config/statusBarViewModel";
import {
  DEFAULT_SETTINGS,
  ParallelismMode,
  RunConfiguration,
  RunnerSettings,
  Stage,
  isMode,
  isStage,
} from "./core/config/types";
import { DEFAULT_FILTER_MAPPING, FilterMappingConfig } from "./core/runner/filterMapping";
import { buildDashboardActionsViewModel, buildRerunFilterFromHistoryEntry, DashboardWebviewCommand } from "./core/results/dashboardActions";
import { resolveFlakyFeaturePath } from "./core/results/flakyDashboard";
import { buildPilotSummaryViewModel, PilotSummaryViewModel } from "./core/results/pilotSummaryViewModel";
import { TREE_SEARCH_WORKSPACE_KEY, shouldConfirmSearchRunCap } from "./core/gherkin/treeSearch";
import { resolveFirstStoreFailureSnippet } from "./core/results/storeFailureFeedback";
import { summarizeOutcomeStore } from "./core/results/outcomeStoreSummary";
import { TreeMappingStats } from "./core/results/trxTreeMapping";
import { RehydrateNotice } from "./core/results/rehydrateNotice";
import { RunHistoryEntry } from "./core/results/runHistory";
import { createPilotRunApi, PilotRunApiV1 } from "./api";
import { isBindingGateMode, BindingGateMode } from "./core/bindings/resolveBindingGateUx";
import { RunTarget } from "./core/runner/filterBuilder";
import {
  formatProgressMessage,
  LiveProgressState,
  TestCompletionEvent,
} from "./core/runner/liveProgress";
import { estimateTestCount } from "./core/runner/runEstimate";
import { pickPrimaryDiagnostic } from "./core/diagnostics/primaryDiagnostic";
import { resolveDashboardPrimaryDiagnostic } from "./core/results/dashboardDiagnostic";
import { analyzeDotnetOutput, AnalyzeDotnetOutputOptions } from "./core/diagnostics/analyzer";
import { buildAiFailureContext } from "./core/diagnostics/aiFailureContext";
import {
  DiagnosticsInOutputMode,
  formatDiagnosticsOutputLines,
} from "./core/diagnostics/diagnosticsOutput";
import {
  buildPostRunFeedback,
  PostRunFeedbackRequest,
  PostRunFeedbackViewModel,
} from "./core/feedback/postRunFeedback";
import { registerFeatureCodeLens } from "./providers/codeLensProvider";
import { DashboardContext, DashboardPanel } from "./providers/dashboardPanel";
import { LocaleService } from "./providers/localeService";
import { ProfileStore } from "./providers/profileStore";
import { RunService } from "./providers/runService";
import { StatusBar } from "./providers/statusBar";
import {
  DomainNode,
  FeatureNode,
  OutlineRowNode,
  ScenarioNode,
  TagNode,
  TestTreeProvider,
  TreeNode,
  readTreeGroupBy,
} from "./providers/testTreeProvider";
import { listDotnetTests } from "./core/runner/listTests";
import { OutcomeStore } from "./providers/outcomeStore";
import { loadRunResults, UnifiedSummary } from "./core/results/resultLoader";
import {
  findPilotTrxCandidates,
  selectLatestPilotTrx,
} from "./core/results/pilotTrxDiscovery";
import { buildRerunFailedFilter, createManagedController, ProjectContext } from "./providers/testController";
import { BDD_PILOT_DEBUG_SESSION_NAME } from "./providers/runService";

const STAGE_KEY = "bddPilot.stage";
const MODE_KEY = "bddPilot.mode";
const PROJECT_KEY = "bddPilot.project";
const HISTORY_KEY = "bddPilot.runHistory";

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

  const runService = new RunService(() =>
    context.workspaceState.get<RunHistoryEntry[]>(HISTORY_KEY, []),
  );

  const outcomeStore = new OutcomeStore();
  let rehydrateNotice: RehydrateNotice | undefined;

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

  const onSearchQueryChanged = (displayQuery: string): void => {
    void context.workspaceState.update(TREE_SEARCH_WORKSPACE_KEY, displayQuery);
    updateSearchContext();
    refreshPilotSurfaces();
  };

  const treeProvider = new TestTreeProvider(
    () => getDiscoveryRoot(),
    outcomeStore,
    () => localeService.getLocale(),
    buildPilotSummaryFromState,
    onSearchQueryChanged,
  );
  const treeView = vscode.window.createTreeView("bddPilot.tests", {
    treeDataProvider: treeProvider,
  });
  // Capa 1 is the pilot summary tree row — never duplicate rollup in TreeView.message.
  treeView.message = undefined;

  const readAiSettings = (): { enabled: boolean; contextMaxOutputLines: number } => {
    const cfg = vscode.workspace.getConfiguration("bddPilot");
    return {
      enabled: cfg.get<boolean>("ai.enabled", true),
      contextMaxOutputLines: Math.max(1, cfg.get<number>("ai.contextMaxOutputLines", 80)),
    };
  };

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

  const refreshPilotSurfaces = () => {
    const locale = localeService.getLocale();
    const summary = buildPilotSummaryFromState();
    treeProvider.refreshPilotSummary();
    dashboard.update(runService.getHistory(), locale, buildDashboardContext(summary));
  };

  const persistHistory = () => {
    rehydrateNotice = undefined;
    void context.workspaceState.update(HISTORY_KEY, runService.getHistory());
    refreshPilotSurfaces();
  };

  runService.onHistoryChanged(() => persistHistory());

  const managed = createManagedController({
    getProjectContext: () => getProjectContext(),
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
    getAnalyzeOptions: () => readAnalyzeOptions(),
    getBindingGate: () => readBindingGate(),
    onResultsApplied: (summary: UnifiedSummary, context) => {
      applyRunSummaryToTree(summary, context.targets, { canceled: context.canceled });
    },
    onPostRunFeedback: (request: PostRunFeedbackRequest) => notifyPostRunFeedback(request),
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

  const refreshAll = (immediateEnrich = true) => {
    refreshTreeSurfaces();
    if (immediateEnrich) {
      cancelScheduledEnrich();
      void enrichTheoryRows();
    } else {
      scheduleEnrichTheoryRows();
    }
  };

  const scheduleEnrichTheoryRows = () => {
    cancelScheduledEnrich();
    enrichTheoryTimer = setTimeout(() => {
      enrichTheoryTimer = undefined;
      void enrichTheoryRows();
    }, FEATURE_ENRICH_DEBOUNCE_MS);
  };

  const enrichTheoryRows = async (signal?: AbortSignal): Promise<void> => {
    const ctx = getProjectContext();
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

  const refreshUi = () => {
    const ctx = getProjectContext();
    const running = !!activeRun || runService.isDebugActive();
    const debugging = runService.isDebugActive() && !activeRun;
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

    managed.finalizePendingDebugRun(
      debugResult.summary,
      debugResult.completionKind,
      "",
    );
    refreshUi();
  };

  const codeLens = registerFeatureCodeLens(() => localeService.getLocale());

  localeService.onDidChangeLocale(() => {
    refreshUi();
    refreshAll();
    codeLens.refresh();
    dashboard.refreshLocale(localeService.getLocale(), buildDashboardContext());
  });

  async function bootstrapWorkspace(): Promise<void> {
    await enrichTheoryRows();
    tryRehydrateOutcomes();
  }

  function logTreeMapping(stats: TreeMappingStats | undefined): void {
    if (!stats || stats.inScope === 0) {
      return;
    }
    output.appendLine(
      `[bdd-pilot] ${tr("log.treeMapping", {
        mapped: stats.mapped,
        inScope: stats.inScope,
        unmapped: stats.unmapped,
      })}`,
    );
  }

  function applyRunSummaryToTree(
    summary: UnifiedSummary,
    targets: RunTarget[],
    options?: { canceled?: boolean; rawFilter?: boolean },
  ): void {
    if (options?.rawFilter || targets.length === 0) {
      treeProvider.applyResults(summary);
    } else {
      const stats = treeProvider.applyScopedResults(summary, targets, {
        canceled: options?.canceled,
      });
      logTreeMapping(stats);
    }
    managed.refresh();
  }

  function tryRehydrateOutcomes(): void {
    const rehydrate = readOutcomeRehydrateSettings();
    if (!rehydrate.enabled) {
      return;
    }
    if (activeRun || runService.isDebugActive()) {
      return;
    }
    if (!outcomeStore.isEmpty()) {
      return;
    }

    const ctx = getProjectContext();
    if (!ctx) {
      return;
    }

    const latest = selectLatestPilotTrx(findPilotTrxCandidates(ctx.projectDir), {
      maxAgeMs: rehydrate.maxAgeMs,
    });
    if (!latest) {
      return;
    }

    const lastHistory = runService.getHistory().at(-1);
    const historyTrx = lastHistory?.trxPath ? path.resolve(lastHistory.trxPath) : undefined;
    if (historyTrx && path.resolve(latest.absolutePath) !== historyTrx) {
      output.appendLine(`[bdd-pilot] ${tr("log.rehydrateSkippedHistoryMismatch")}`);
      return;
    }

    const summary = loadRunResults(ctx.projectDir, latest.absolutePath);
    if (!summary || summary.total === 0) {
      return;
    }

    treeProvider.applyResults(summary);
    managed.refresh();
    rehydrateNotice = {
      trxFileName: latest.fileName,
      mtimeMs: latest.mtimeMs,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      total: summary.total,
    };
    refreshPilotSurfaces();
    output.appendLine(
      `[bdd-pilot] ${tr("log.rehydrateRestored", {
        file: latest.fileName,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        total: summary.total,
      })}`,
    );
  }

  type PostRunToastMode = "off" | "failures" | "always";

  const readPostRunToast = (): PostRunToastMode => {
    const value = vscode.workspace.getConfiguration("bddPilot").get<string>("feedback.postRunToast", "failures");
    if (value === "off" || value === "always") {
      return value;
    }
    return "failures";
  };

  const readAnalyzeOptions = (): AnalyzeDotnetOutputOptions => {
    const cfg = vscode.workspace.getConfiguration("bddPilot");
    return {
      extendedRules: cfg.get<boolean>("diagnostics.extendedRules", false),
      locale: localeService.getLocale(),
    };
  };

  const readDiagnosticsInOutput = (): DiagnosticsInOutputMode => {
    const value = vscode.workspace
      .getConfiguration("bddPilot")
      .get<string>("feedback.diagnosticsInOutput", "summary");
    if (value === "off" || value === "full") {
      return value;
    }
    return "summary";
  };

  function appendRunDiagnosticsToOutput(text: string): void {
    const analyzeOptions = readAnalyzeOptions();
    const diagnostics = analyzeDotnetOutput(text, analyzeOptions);
    for (const line of formatDiagnosticsOutputLines(
      diagnostics,
      readDiagnosticsInOutput(),
      analyzeOptions.locale ?? "en",
    )) {
      output.appendLine(line);
    }
  }

  function presentPostRunFeedback(vm: PostRunFeedbackViewModel | undefined): void {
    if (!vm?.message) {
      return;
    }
    const labels = vm.actions.map((action) => {
      switch (action) {
        case "showOutput":
          return tr("action.showOutput");
        case "rerunFailed":
          return tr("action.rerunFailed");
        case "copyForAi":
          return tr("action.copyForAi");
      }
    });
    const show =
      vm.severity === "error"
        ? vscode.window.showErrorMessage
        : vm.severity === "warning"
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;
    void show(vm.message, ...labels).then((choice) => {
      if (choice === tr("action.showOutput")) {
        output.show(true);
      } else if (choice === tr("action.rerunFailed")) {
        void vscode.commands.executeCommand("bddPilot.rerunFailed");
      } else if (choice === tr("action.copyForAi")) {
        void copyFailureContextForAi();
      }
    });
  }

  function notifyPostRunFeedback(request: PostRunFeedbackRequest): void {
    if (!request.canceled && !request.debug) {
      if (request.exitCode !== 0 || (request.summary?.failed ?? 0) > 0) {
        appendRunDiagnosticsToOutput(request.outputBuffer);
      }
    }
    const vm = buildPostRunFeedback({
      ...request,
      locale: localeService.getLocale(),
      analyzeOptions: readAnalyzeOptions(),
      toastMode: readPostRunToast(),
      canRerunFailed: !!buildRerunFailedFilter(runService, readSettings().filterMapping),
      canCopyForAi: readAiSettings().enabled && !!runService.getLastFailedRunSnapshot(),
    });
    presentPostRunFeedback(vm);
  }

  const copyFailureContextForAi = async (): Promise<void> => {
    const snapshot = runService.getLastFailedRunSnapshot();
    if (!snapshot) {
      void vscode.window.showInformationMessage(tr("toast.noFailureContext"));
      return;
    }

    const sensitiveStages = new Set<Stage>(["stg", "prod"]);
    if (sensitiveStages.has(snapshot.stage as Stage)) {
      const copyAnyway = tr("action.copyAnyway");
      const choice = await vscode.window.showWarningMessage(
        tr("toast.failureContextProdWarning"),
        { modal: true },
        copyAnyway,
      );
      if (choice !== copyAnyway) {
        return;
      }
    }

    const ai = readAiSettings();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const markdown = buildAiFailureContext(snapshot, {
      maxOutputLines: ai.contextMaxOutputLines,
      extensionVersion: context.extension.packageJSON.version,
      workspaceRoot,
      analyzeOptions: readAnalyzeOptions(),
    });
    await vscode.env.clipboard.writeText(markdown);
    void vscode.window.showInformationMessage(tr("toast.failureContextCopied"));
  };

  context.subscriptions.push(
    output,
    localeService,
    statusBar,
    { dispose: cancelScheduledEnrich },
    treeView,
    managed.controller,
    codeLens.disposable,

    vscode.commands.registerCommand("bddPilot.refresh", () => refreshAll()),

    vscode.commands.registerCommand("bddPilot.showOutput", () => output.show(true)),

    vscode.commands.registerCommand("bddPilot.copyFailureContextForAi", () => {
      if (!readAiSettings().enabled) {
        return;
      }
      void copyFailureContextForAi();
    }),

    vscode.commands.registerCommand("bddPilot.showDashboard", () => {
      const history = runService.getHistory();
      dashboard.show(history, localeService.getLocale(), buildDashboardContext());
      if (history.length === 0) {
        void vscode.window.showInformationMessage(tr("toast.dashboardEmpty"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.searchTests", async () => {
      const query = await vscode.window.showInputBox({
        value: treeProvider.getSearchQuery(),
        placeHolder: tr("prompt.searchFilter"),
        prompt: tr("prompt.searchClear"),
      });
      if (query !== undefined) {
        treeProvider.setSearchQuery(query);
      }
    }),

    vscode.commands.registerCommand("bddPilot.searchTestsActive", () => {
      void vscode.commands.executeCommand("bddPilot.searchTests");
    }),

    vscode.commands.registerCommand("bddPilot.clearSearch", () => {
      treeProvider.setSearchQuery("");
    }),

    vscode.commands.registerCommand("bddPilot.runFiltered", async () => {
      const targets = treeProvider.getFilteredRunTargets();
      if (targets.length === 0) {
        void vscode.window.showInformationMessage(tr("toast.searchNoMatches"));
        return;
      }
      const cap = readSearchRunCap();
      if (shouldConfirmSearchRunCap(targets.length, cap)) {
        const runLabel = tr("action.runFiltered");
        const choice = await vscode.window.showWarningMessage(
          tr("toast.runFilteredConfirm", { count: targets.length }),
          { modal: true },
          runLabel,
        );
        if (choice !== runLabel) {
          return;
        }
      }
      await executeRun(targets);
    }),

    vscode.commands.registerCommand("bddPilot.selectProject", () => selectProject()),

    vscode.commands.registerCommand("bddPilot.openStatusBarHub", () => openStatusBarHub()),

    vscode.commands.registerCommand("bddPilot.selectStage", async () => {
      const locale = localeService.getLocale();
      const items = buildStageHubPickItems(currentStage, locale);
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ label: item.label, description: item.description, value: item.value })),
        { placeHolder: tr("prompt.selectStage", { current: currentStage }) },
      );
      if (picked && isStage(picked.value)) {
        currentStage = picked.value;
        await context.workspaceState.update(STAGE_KEY, picked.value);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectMode", async () => {
      const locale = localeService.getLocale();
      const items = buildModeHubPickItems(currentMode, locale);
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ label: item.label, description: item.description, value: item.value })),
        { placeHolder: tr("prompt.selectMode", { current: currentMode }) },
      );
      if (picked && isMode(picked.value)) {
        currentMode = picked.value;
        await context.workspaceState.update(MODE_KEY, picked.value);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.cancel", () => {
      if (activeRun) {
        activeRun.abort();
        output.appendLine("\n[bdd-pilot] Cancellation requested...");
      } else {
        void vscode.window.showInformationMessage(tr("toast.noActiveRun"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.runAll", async () => {
      await executeRun({ kind: "all" });
    }),

    vscode.commands.registerCommand("bddPilot.runNode", async (node: TreeNode) => {
      const target = toRunTarget(node);
      if (target) {
        await executeRun(target);
      }
    }),

    vscode.commands.registerCommand("bddPilot.debugNode", async (node: TreeNode) => {
      const target = toRunTarget(node);
      if (target) {
        await executeRun(target, { debug: true });
      }
    }),

    vscode.commands.registerCommand("bddPilot.runFromCodeLens", async (target: RunTarget, debug?: boolean) => {
      await executeRun(target, { debug: !!debug });
    }),

    vscode.commands.registerCommand("bddPilot.rerunFailed", async () => {
      const filter = buildRerunFailedFilter(runService, readSettings().filterMapping);
      if (!filter) {
        void vscode.window.showInformationMessage(tr("toast.noFailedRerun"));
        return;
      }
      await executeRun({ kind: "all" }, { rawFilter: filter });
    }),

    vscode.commands.registerCommand("bddPilot.saveProfile", async () => {
      const name = await vscode.window.showInputBox({ prompt: tr("prompt.profileName") });
      if (!name) {
        return;
      }
      const filter = await vscode.window.showInputBox({
        prompt: tr("prompt.profileFilter"),
        placeHolder: tr("prompt.profileFilterExample"),
      });
      if (!filter) {
        return;
      }
      const profile: ExecutionProfile = {
        id: `profile-${Date.now()}`,
        name,
        filter,
      };
      await profileStore.save(profile);
      void vscode.window.showInformationMessage(tr("toast.profileSaved", { name }));
    }),

    vscode.commands.registerCommand("bddPilot.runProfile", async () => {
      const profiles = profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage(tr("toast.noProfilesRun"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, profile: p })),
        { placeHolder: tr("prompt.selectProfileRun") },
      );
      if (picked) {
        await executeRun({ kind: "all" }, { rawFilter: picked.profile.filter });
      }
    }),

    vscode.commands.registerCommand("bddPilot.manageProfiles", async () => {
      const profiles = profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage(tr("toast.noProfilesManage"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, id: p.id })),
        { placeHolder: tr("prompt.selectProfileDelete") },
      );
      if (picked) {
        await profileStore.remove(picked.id);
        void vscode.window.showInformationMessage(tr("toast.profileRemoved", { name: picked.label }));
      }
    }),

    vscode.commands.registerCommand("bddPilot.cycleTreeGroupBy", async () => {
      const cfg = vscode.workspace.getConfiguration("bddPilot");
      const current = cfg.get<string>("tree.groupBy", "domain");
      const next = current === "tag" ? "domain" : "tag";
      await cfg.update("tree.groupBy", next, vscode.ConfigurationTarget.Workspace);
      updateTreeGroupByContext();
      void vscode.window.showInformationMessage(
        next === "tag" ? tr("toast.treeGroupByTag") : tr("toast.treeGroupByDomain"),
      );
    }),

    vscode.commands.registerCommand("bddPilot.cycleTreeGroupByDomain", () => {
      void vscode.commands.executeCommand("bddPilot.cycleTreeGroupBy");
    }),

    vscode.commands.registerCommand("bddPilot.cycleTreeGroupByTag", () => {
      void vscode.commands.executeCommand("bddPilot.cycleTreeGroupBy");
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bddPilot")) {
        refreshAll();
        refreshUi();
      }
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.toLowerCase().endsWith(".feature")) {
        refreshTreeSurfaces();
        scheduleEnrichTheoryRows();
      }
    }),

    vscode.debug.onDidTerminateDebugSession((session) => {
      if (session.name === BDD_PILOT_DEBUG_SESSION_NAME) {
        handleDebugSessionEnded();
      }
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
  void maybePromptProjectSelection();

  function toRunTarget(node: TreeNode | undefined): RunTarget | undefined {
    if (!node) {
      return { kind: "all" };
    }
    if (node.kind === "pilotSummary") {
      return undefined;
    }
    if (node.kind === "domain") {
      return { kind: "domain", group: (node as DomainNode).group };
    }
    if (node.kind === "tag") {
      return { kind: "tag", tag: (node as TagNode).group.tag };
    }
    if (node.kind === "feature") {
      return { kind: "feature", feature: (node as FeatureNode).feature };
    }
    if (node.kind === "outlineRow") {
      const row = node as OutlineRowNode;
      return {
        kind: "outlineRow",
        feature: row.feature,
        scenario: row.scenario,
        example: row.example,
      };
    }
    return {
      kind: "scenario",
      feature: (node as ScenarioNode).feature,
      scenario: (node as ScenarioNode).scenario,
    };
  }

  async function executeRun(
    target: RunTarget | RunTarget[],
    opts?: { debug?: boolean; rawFilter?: string },
  ): Promise<void> {
    if (activeRun || runService.isDebugActive()) {
      if (opts?.debug) {
        void vscode.window.showWarningMessage(
          runService.isDebugActive() ? tr("toast.debugAlreadyActive") : tr("toast.debugWhileRunning"),
        );
      } else {
        void vscode.window.showWarningMessage(tr("toast.runInProgress"));
      }
      return;
    }

    const settings = readSettings();
    const ctx = getProjectContext();
    if (!ctx) {
      if (!(await selectProject())) {
        return;
      }
    }
    const project = getProjectContext();
    if (!project) {
      void vscode.window.showErrorMessage(tr("toast.projectNotFound"));
      return;
    }

    const runTargets = opts?.rawFilter ? [] : resolveRunTargets(target);
    const totalExpected =
      opts?.rawFilter || opts?.debug
        ? undefined
        : estimateTestCount(runTargets, project.discoveryRoot);

    if (opts?.debug && treeProvider.needsTheoryDiscovery()) {
      await enrichTheoryRows();
    }

    const controller = new AbortController();
    if (!opts?.debug) {
      activeRun = controller;
      clearActiveLiveProgress();
      refreshUi();
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
          ? tr("progress.debugging", { stage: currentStage })
          : tr("progress.running", { stage: currentStage, mode: currentMode }),
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
            activeLiveProgress = state;
            scheduleProgressSummaryRefresh();
          }
          const message = formatProgressMessage(state, localeService.getLocale());
          if (event && progressIncrement > 0) {
            lastMessage = message;
            progress.report({ message, increment: progressIncrement });
          } else if (message !== lastMessage) {
            lastMessage = message;
            progress.report({ message });
          }
          if (event) {
            treeProvider.applyLiveResult(event.testName, event.outcome);
          }
        };

        try {
          if (!opts?.debug && treeProvider.needsTheoryDiscovery()) {
            progress.report({ message: tr("progress.discovering") });
            try {
              await enrichTheoryRows(controller.signal);
            } catch {
              // list-tests canceled — handled below via signal.aborted
            }
            if (controller.signal.aborted) {
              output.appendLine("\n[bdd-pilot] Run canceled.");
              notifyPostRunFeedback({
                canceled: true,
                debug: false,
                outputBuffer: "",
                exitCode: null,
              });
              return;
            }
          }

          if (!opts?.debug) {
            output.clear();
            output.show(true);
            if (!opts?.rawFilter) {
              const scopeTargets = runTargets.length > 0 ? runTargets : [{ kind: "all" as const }];
              treeProvider.clearResultsForRunScope(scopeTargets);
            }

            const loadedEnv = loadStageEnv(project.projectDir, currentStage);
            const envMissingKey = `bddPilot.envMissingNotified.${currentStage}`;
            if (loadedEnv.loadedFiles.length > 0) {
              void context.workspaceState.update(envMissingKey, undefined);
              const names = loadedEnv.loadedFiles.map((f) => path.basename(f)).join(", ");
              output.appendLine(
                tr("log.envLoaded", {
                  files: names,
                  count: Object.keys(loadedEnv.vars).length,
                }),
              );
            } else if (!context.workspaceState.get<boolean>(envMissingKey)) {
              output.appendLine(tr("log.envMissing", { stage: currentStage }));
              void context.workspaceState.update(envMissingKey, true);
            }
          }

          const result = await runService.run({
            targets: runTargets,
            rawFilter: opts?.rawFilter,
            stage: currentStage,
            mode: currentMode,
            settings,
            projectDir: project.projectDir,
            testTarget: project.testTarget,
            debug: opts?.debug,
            locale: localeService.getLocale(),
            signal: controller.signal,
            totalExpected,
            bindingGate: readBindingGate(),
            domains: treeProvider.getDomains(),
            analyzeOptions: readAnalyzeOptions(),
            onProgress,
            onOutput: (chunk) => output.append(chunk),
            onStart: (cmd) => output.appendLine(`[bdd-pilot] ${cmd}\n`),
          });

          if (result.canceled) {
            output.appendLine("\n[bdd-pilot] Run canceled.");
            if (result.summary) {
              applyRunSummaryToTree(result.summary, runTargets, { canceled: true });
              output.appendLine(
                `[bdd-pilot] Partial results (${result.summary.source}): ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.total} total).`,
              );
            }
            notifyPostRunFeedback({
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
              refreshUi();
            }
            return;
          }

          output.appendLine(`\n[bdd-pilot] Process exited with code ${result.exitCode}.`);
          if (result.summary) {
            applyRunSummaryToTree(result.summary, runTargets, { rawFilter: !!opts?.rawFilter });
            output.appendLine(
              `[bdd-pilot] Results (${result.summary.source}): ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.total} total).`,
            );
          }
          notifyPostRunFeedback({
            canceled: false,
            debug: false,
            outputBuffer: result.outputBuffer,
            exitCode: result.exitCode,
            summary: result.summary,
          });
          persistHistory();
        } catch (err) {
          output.appendLine(`\n[bdd-pilot] Error: ${String(err)}`);
          appendRunDiagnosticsToOutput(String(err));
          notifyPostRunFeedback({
            canceled: false,
            debug: false,
            outputBuffer: String(err),
            exitCode: 1,
            fallbackMessage: `BDD Pilot: ${String(err)}`,
          });
        } finally {
          if (!opts?.debug) {
            activeRun = undefined;
            clearActiveLiveProgress();
            refreshUi();
          }
        }
      },
    );
  }

  const handleDashboardCommand = async (command: DashboardWebviewCommand): Promise<void> => {
    const ctx = buildDashboardContext();
    const target = ctx.actions?.target;
    switch (command) {
      case "showOutput":
        output.show(true);
        return;
      case "copyForAi":
        await copyFailureContextForAi();
        return;
      case "rerunFailed": {
        if (!target) {
          return;
        }
        if (target.kind === "session") {
          await vscode.commands.executeCommand("bddPilot.rerunFailed");
          return;
        }
        if (!target.entryId) {
          return;
        }
        const entry = runService.getHistory().find((e) => e.id === target.entryId);
        if (!entry) {
          return;
        }
        const filter = buildRerunFilterFromHistoryEntry(
          entry,
          readSettings().filterMapping,
          treeProvider.getDomains(),
        );
        if (!filter) {
          void vscode.window.showInformationMessage(tr("toast.noFailedRerun"));
          return;
        }
        await executeRun({ kind: "all" }, { rawFilter: filter });
        return;
      }
    }
  };

  dashboard.setMessageHandler((command) => {
    void handleDashboardCommand(command);
  });

  dashboard.setFlakyOpenHandler((target) => {
    void openFlakyScenario(target);
  });

  async function openFlakyScenario(target: { featurePath: string; scenarioLine: number }): Promise<void> {
    try {
      const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
      const resolvedPath = resolveFlakyFeaturePath(target.featurePath, roots);
      const uri = vscode.Uri.file(resolvedPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const line = Math.max(0, target.scenarioLine - 1);
      const position = new vscode.Position(line, 0);
      const range = new vscode.Range(position, position);
      const editor = await vscode.window.showTextDocument(doc, { selection: range });
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch {
      void vscode.window.showWarningMessage(tr("dashboard.flakyOpenFailed"));
    }
  }

  function normalizeTargets(target: RunTarget): RunTarget[] {
    if (target.kind === "all") {
      return [{ kind: "all" }];
    }
    return [target];
  }

  function resolveRunTargets(target: RunTarget | RunTarget[]): RunTarget[] {
    if (Array.isArray(target)) {
      return target;
    }
    return normalizeTargets(target);
  }

  function getWorkspaceRoots(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  }

  function readStoredProject(context: vscode.ExtensionContext): StoredProjectSelection | undefined {
    return context.workspaceState.get<StoredProjectSelection>(PROJECT_KEY);
  }

  function getResolvedProject(): ResolvedProject | undefined {
    const settings = readSettings();
    const roots = getWorkspaceRoots();
    return resolveProject(roots, settings.projectPath, readStoredProject(context));
  }

  function getProjectContext(): ProjectContext | undefined {
    const project = getResolvedProject();
    if (!project) {
      return undefined;
    }
    const roots = getWorkspaceRoots();
    const execution = resolveExecutionTarget(project, roots);
    return {
      projectDir: execution.projectDir,
      testTarget: execution.testTarget,
      discoveryRoot: discoveryRoot(project, roots),
      label: project.label,
      selectedKind: project.kind,
    };
  }

  function getDiscoveryRoot(): string | undefined {
    return getProjectContext()?.discoveryRoot;
  }

  async function applyProjectSelection(project: ResolvedProject): Promise<void> {
    const settings = readSettings();
    const previousProjectDir = getProjectContext()?.projectDir;
    if (!settings.projectPath.trim()) {
      await context.workspaceState.update(PROJECT_KEY, toStoredSelection(project));
    }
    refreshAll();
    refreshUi();
    const newProjectDir = getProjectContext()?.projectDir;
    if (newProjectDir && newProjectDir !== previousProjectDir) {
      outcomeStore.clearAll();
      tryRehydrateOutcomes();
      refreshPilotSurfaces();
    }
  }

  async function openStatusBarHub(): Promise<void> {
    type HubPick = vscode.QuickPickItem & {
      hubKind?: "stage" | "mode" | "project";
      hubValue?: string;
      project?: ResolvedProject;
    };

    const locale = localeService.getLocale();
    const items: HubPick[] = [
      { label: tr("statusBar.hubSectionStage"), kind: vscode.QuickPickItemKind.Separator },
      ...buildStageHubPickItems(currentStage, locale).map((item) => ({
        label: item.label,
        description: item.description,
        hubKind: "stage" as const,
        hubValue: item.value,
      })),
      { label: tr("statusBar.hubSectionMode"), kind: vscode.QuickPickItemKind.Separator },
      ...buildModeHubPickItems(currentMode, locale).map((item) => ({
        label: item.label,
        description: item.description,
        hubKind: "mode" as const,
        hubValue: item.value,
      })),
    ];

    const roots = getWorkspaceRoots();
    const settings = readSettings();
    const ambiguous = expandDirectoryAmbiguity(roots, settings.projectPath);
    const projects = ambiguous ?? listSelectableProjects(roots);
    if (projects.length > 0) {
      items.push({ label: tr("statusBar.hubSectionProject"), kind: vscode.QuickPickItemKind.Separator });
      const currentLabel = getProjectContext()?.label;
      for (const project of projects) {
        items.push({
          label: project.label === currentLabel ? `$(check) ${project.label}` : project.label,
          description: project.kind === "sln" ? tr("quickPick.solution") : project.projectDir,
          hubKind: "project",
          project,
        });
      }
    }

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: tr("statusBar.hubTooltipTitle"),
      matchOnDescription: true,
    });
    if (!picked?.hubKind) {
      return;
    }

    if (picked.hubKind === "stage" && picked.hubValue && isStage(picked.hubValue)) {
      currentStage = picked.hubValue;
      await context.workspaceState.update(STAGE_KEY, picked.hubValue);
      refreshUi();
      return;
    }

    if (picked.hubKind === "mode" && picked.hubValue && isMode(picked.hubValue)) {
      currentMode = picked.hubValue;
      await context.workspaceState.update(MODE_KEY, picked.hubValue);
      refreshUi();
      return;
    }

    if (picked.hubKind === "project" && picked.project) {
      await applyProjectSelection(picked.project);
    }
  }

  async function selectProject(): Promise<ResolvedProject | undefined> {
    const roots = getWorkspaceRoots();
    const settings = readSettings();
    const ambiguous = expandDirectoryAmbiguity(roots, settings.projectPath);
    const items = ambiguous ?? listSelectableProjects(roots);
    if (items.length === 0) {
      void vscode.window.showWarningMessage(tr("toast.noProjectsFound"));
      return undefined;
    }

    const picked = await vscode.window.showQuickPick(
      items.map((p) => ({
        label: p.label,
        description: p.kind === "sln" ? tr("quickPick.solution") : p.projectDir,
        project: p,
      })),
      { placeHolder: tr("prompt.selectProject") },
    );
    if (!picked) {
      return undefined;
    }

    await applyProjectSelection(picked.project);
    return picked.project;
  }

  async function maybePromptProjectSelection(): Promise<void> {
    if (readSettings().projectPath.trim()) {
      return;
    }
    const roots = getWorkspaceRoots();
    const candidates = discoverProjectCandidates(roots);
    if (candidates.length <= 1) {
      return;
    }
    if (readStoredProject(context)) {
      return;
    }
    const selectProjectLabel = tr("action.selectProject");
    void vscode.window
      .showInformationMessage(tr("toast.multiProjectPrompt"), selectProjectLabel)
      .then((choice) => {
        if (choice === selectProjectLabel) {
          void selectProject();
        }
      });
  }

  return createPilotRunApi({
    runService,
    outcomeStore,
    isReady: () => getResolvedProject() !== undefined,
    isRunInProgress: () => !!activeRun || runService.isDebugActive(),
    getDomains: () => treeProvider.getDomains(),
  });
}

export function deactivate(): void {
  // no-op
}

function readStatusBarDisplay(): StatusBarDisplayMode {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return readStatusBarDisplayMode(cfg.get<string>("statusBar.display", "compact"));
}

function readSearchRunCap(): number {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return Math.max(0, cfg.get<number>("tree.searchRunCap", 80));
}

function readBindingGate(): BindingGateMode {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const value = cfg.get<string>("preRun.bindingGate", "warn");
  return isBindingGateMode(value) ? value : "warn";
}

function isRunConfiguration(value: string): value is RunConfiguration {
  return value === "" || value === "Debug" || value === "Release";
}

function readSettings(): RunnerSettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const stage = cfg.get<string>("defaultStage", DEFAULT_SETTINGS.defaultStage);
  const mode = cfg.get<string>("defaultMode", DEFAULT_SETTINGS.defaultMode);
  const confirmStages = cfg
    .get<string[]>("requireConfirmationForStages", DEFAULT_SETTINGS.requireConfirmationForStages)
    .filter(isStage);
  const runConfiguration = cfg.get<string>("run.configuration", DEFAULT_SETTINGS.runConfiguration);
  return {
    projectPath: cfg.get<string>("projectPath", DEFAULT_SETTINGS.projectPath),
    defaultStage: isStage(stage) ? stage : DEFAULT_SETTINGS.defaultStage,
    defaultMode: isMode(mode) ? mode : DEFAULT_SETTINGS.defaultMode,
    requireConfirmationForStages: confirmStages as Stage[],
    dotnetPath: cfg.get<string>("dotnetPath", DEFAULT_SETTINGS.dotnetPath),
    filterMapping: readFilterMapping(cfg),
    runConfiguration: isRunConfiguration(runConfiguration)
      ? runConfiguration
      : DEFAULT_SETTINGS.runConfiguration,
    runNoBuild: cfg.get<boolean>("run.noBuild", DEFAULT_SETTINGS.runNoBuild),
    runSettingsPath: cfg.get<string>("run.runSettings", DEFAULT_SETTINGS.runSettingsPath),
  };
}

function readFilterMapping(cfg: vscode.WorkspaceConfiguration): FilterMappingConfig {
  const outlineRow = cfg.get<string>("filter.outlineRowFilter", DEFAULT_FILTER_MAPPING.outlineRowFilter);
  return {
    featureClassSuffix: cfg.get<string>(
      "filter.featureClassSuffix",
      DEFAULT_FILTER_MAPPING.featureClassSuffix,
    ),
    tagTraitName: cfg.get<string>("filter.tagTraitName", DEFAULT_FILTER_MAPPING.tagTraitName),
    outlineRowFilter:
      outlineRow === "scenarioOnly" ? "scenarioOnly" : DEFAULT_FILTER_MAPPING.outlineRowFilter,
  };
}

function readStoredStage(context: vscode.ExtensionContext): Stage | undefined {
  const value = context.workspaceState.get<string>(STAGE_KEY);
  return value && isStage(value) ? value : undefined;
}

function readStoredMode(context: vscode.ExtensionContext): ParallelismMode | undefined {
  const value = context.workspaceState.get<string>(MODE_KEY);
  return value && isMode(value) ? value : undefined;
}

function readOutcomeRehydrateSettings(): { enabled: boolean; maxAgeMs: number | undefined } {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const mode = cfg.get<string>("outcomes.rehydrateOnActivate", "on");
  const hours = Math.max(0, cfg.get<number>("outcomes.rehydrateMaxAgeHours", 168));
  return {
    enabled: mode !== "off",
    maxAgeMs: hours > 0 ? hours * 3_600_000 : undefined,
  };
}
