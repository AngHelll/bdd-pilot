import * as path from "path";
import * as vscode from "vscode";
import { ExecutionProfile } from "./core/config/profiles";
import {
  discoveryRoot,
  expandDirectoryAmbiguity,
  listSelectableProjects,
  resolveProject,
  ResolvedProject,
  StoredProjectSelection,
  toStoredSelection,
} from "./core/config/projectResolution";
import { discoverProjectCandidates } from "./core/config/projectLocator";
import { loadStageEnv } from "./core/config/envFile";
import {
  ALL_MODES,
  ALL_STAGES,
  DEFAULT_SETTINGS,
  ParallelismMode,
  RunnerSettings,
  Stage,
  isMode,
  isStage,
} from "./core/config/types";
import { DEFAULT_FILTER_MAPPING, FilterMappingConfig } from "./core/runner/filterMapping";
import { RunHistoryEntry } from "./core/results/runHistory";
import { RunTarget } from "./core/runner/filterBuilder";
import {
  formatProgressMessage,
  LiveProgressState,
  TestCompletionEvent,
} from "./core/runner/liveProgress";
import { estimateTestCount } from "./core/runner/runEstimate";
import { analyzeDotnetOutput } from "./core/diagnostics/analyzer";
import { registerFeatureCodeLens } from "./providers/codeLensProvider";
import { DashboardPanel } from "./providers/dashboardPanel";
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
import { UnifiedSummary } from "./core/results/resultLoader";
import { buildRerunFailedFilter, createManagedController, ProjectContext } from "./providers/testController";

const STAGE_KEY = "bddPilot.stage";
const MODE_KEY = "bddPilot.mode";
const PROJECT_KEY = "bddPilot.project";
const HISTORY_KEY = "bddPilot.runHistory";

export function activate(context: vscode.ExtensionContext): void {
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

  const runService = new RunService(() =>
    context.workspaceState.get<RunHistoryEntry[]>(HISTORY_KEY, []),
  );

  const outcomeStore = new OutcomeStore();
  const treeProvider = new TestTreeProvider(() => getDiscoveryRoot(), outcomeStore);
  const treeView = vscode.window.createTreeView("bddPilot.tests", {
    treeDataProvider: treeProvider,
  });

  const persistHistory = () => {
    void context.workspaceState.update(HISTORY_KEY, runService.getHistory());
    dashboard.update(runService.getHistory(), localeService.getLocale());
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
    onResultsApplied: (summary: UnifiedSummary) => {
      treeProvider.applyResults(summary);
      managed.refresh();
    },
    acquireRunLock: () => {
      if (activeRun) {
        return false;
      }
      activeRun = new AbortController();
      refreshUi();
      return true;
    },
    releaseRunLock: () => {
      activeRun = undefined;
      refreshUi();
    },
    abortActiveRun: () => activeRun?.abort(),
  });

  const refreshAll = () => {
    treeProvider.refresh();
    managed.refresh();
    void enrichTheoryRows();
  };

  const enrichTheoryRows = async (): Promise<void> => {
    const ctx = getProjectContext();
    if (!ctx) {
      return;
    }
    const settings = readSettings();
    const enriched = await treeProvider.enrichTheoryRows(() =>
      listDotnetTests({
        dotnetPath: settings.dotnetPath,
        projectDir: ctx.projectDir,
        testTarget: ctx.testTarget,
      }),
    );
    if (enriched) {
      managed.refresh();
    }
  };

  const refreshUi = () => {
    const ctx = getProjectContext();
    statusBar.update(currentStage, currentMode, localeService.getLocale(), ctx?.label);
    void vscode.commands.executeCommand("setContext", "bddPilot.running", !!activeRun);
  };

  const codeLens = registerFeatureCodeLens(() => localeService.getLocale());

  localeService.onDidChangeLocale(() => {
    refreshUi();
    codeLens.refresh();
    dashboard.refreshLocale(localeService.getLocale());
  });

  refreshAll();
  refreshUi();
  void maybePromptProjectSelection();

  context.subscriptions.push(
    output,
    localeService,
    statusBar,
    treeView,
    managed.controller,
    codeLens.disposable,

    vscode.commands.registerCommand("bddPilot.refresh", () => refreshAll()),

    vscode.commands.registerCommand("bddPilot.showOutput", () => output.show(true)),

    vscode.commands.registerCommand("bddPilot.showDashboard", () => {
      const history = runService.getHistory();
      dashboard.show(history, localeService.getLocale());
      if (history.length === 0) {
        void vscode.window.showInformationMessage(tr("toast.dashboardEmpty"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.searchTests", async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: tr("prompt.searchFilter"),
        prompt: tr("prompt.searchClear"),
      });
      if (query !== undefined) {
        treeProvider.setSearchQuery(query);
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectProject", () => selectProject()),

    vscode.commands.registerCommand("bddPilot.selectStage", async () => {
      const picked = await vscode.window.showQuickPick(ALL_STAGES, {
        placeHolder: tr("prompt.selectStage", { current: currentStage }),
      });
      if (picked && isStage(picked)) {
        currentStage = picked;
        await context.workspaceState.update(STAGE_KEY, picked);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectMode", async () => {
      const picked = await vscode.window.showQuickPick(ALL_MODES, {
        placeHolder: tr("prompt.selectMode", { current: currentMode }),
      });
      if (picked && isMode(picked)) {
        currentMode = picked;
        await context.workspaceState.update(MODE_KEY, picked);
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
      void vscode.window.showInformationMessage(
        next === "tag" ? tr("toast.treeGroupByTag") : tr("toast.treeGroupByDomain"),
      );
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bddPilot")) {
        refreshAll();
        refreshUi();
      }
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.toLowerCase().endsWith(".feature")) {
        refreshAll();
      }
    }),
  );

  function toRunTarget(node: TreeNode | undefined): RunTarget | undefined {
    if (!node) {
      return { kind: "all" };
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
    target: RunTarget,
    opts?: { debug?: boolean; rawFilter?: string },
  ): Promise<void> {
    if (activeRun && !opts?.debug) {
      void vscode.window.showWarningMessage(tr("toast.runInProgress"));
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

    const runTargets = opts?.rawFilter ? [] : normalizeTargets(target);
    const totalExpected =
      opts?.rawFilter || opts?.debug
        ? undefined
        : estimateTestCount(runTargets, project.discoveryRoot);

    const controller = new AbortController();
    if (!opts?.debug) {
      activeRun = controller;
      refreshUi();
      output.clear();
      output.show(true);
      if (!opts?.rawFilter) {
        const scopeTargets = runTargets.length > 0 ? runTargets : [{ kind: "all" as const }];
        treeProvider.clearResultsForRunScope(scopeTargets);
      }

      const loadedEnv = loadStageEnv(project.projectDir, currentStage);
      if (loadedEnv.loadedFiles.length > 0) {
        const names = loadedEnv.loadedFiles.map((f) => path.basename(f)).join(", ");
        output.appendLine(
          `[bdd-pilot] Loaded environment from ${names} (${Object.keys(loadedEnv.vars).length} variables, values hidden).`,
        );
      } else {
        output.appendLine(
          `[bdd-pilot] No config/.env.${currentStage} found. Tests will rely on the current process environment.`,
        );
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: opts?.debug
          ? tr("progress.debugging", { stage: currentStage })
          : tr("progress.running", { stage: currentStage, mode: currentMode }),
        cancellable: !opts?.debug,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        const progressIncrement = totalExpected && totalExpected > 0 ? 100 / totalExpected : 0;
        let lastMessage = "";

        const onProgress = (state: LiveProgressState, event?: TestCompletionEvent) => {
          const message = formatProgressMessage(state);
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
            onProgress,
            onOutput: (chunk) => output.append(chunk),
            onStart: (cmd) => output.appendLine(`[bdd-pilot] ${cmd}\n`),
          });

          if (result.canceled) {
            output.appendLine("\n[bdd-pilot] Run canceled.");
            return;
          }

          if (opts?.debug) {
            return;
          }

          output.appendLine(`\n[bdd-pilot] Process exited with code ${result.exitCode}.`);
          if (result.summary) {
            treeProvider.applyResults(result.summary);
            output.appendLine(
              `[bdd-pilot] Results (${result.summary.source}): ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.skipped} skipped (${result.summary.total} total).`,
            );
          }
          if (result.exitCode !== 0) {
            reportDiagnostics(result.outputBuffer);
          }
          persistHistory();
        } catch (err) {
          output.appendLine(`\n[bdd-pilot] Error: ${String(err)}`);
          reportDiagnostics(String(err), `BDD Pilot: ${String(err)}`);
        } finally {
          if (!opts?.debug) {
            activeRun = undefined;
            refreshUi();
          }
        }
      },
    );
  }

  function normalizeTargets(target: RunTarget): RunTarget[] {
    if (target.kind === "all") {
      return [{ kind: "all" }];
    }
    return [target];
  }

  function reportDiagnostics(text: string, fallbackMessage?: string): void {
    const diagnostics = analyzeDotnetOutput(text);
    if (diagnostics.length === 0) {
      if (fallbackMessage) {
        void vscode.window.showErrorMessage(fallbackMessage);
      }
      return;
    }

    output.appendLine("\n[bdd-pilot] Diagnostics:");
    for (const d of diagnostics) {
      output.appendLine(`  • [${d.code}] ${d.title}${d.detail ? `\n    ${d.detail}` : ""}\n    → ${d.hint}`);
    }

    const top = diagnostics[0];
    const show =
      top.severity === "error"
        ? vscode.window.showErrorMessage
        : top.severity === "warning"
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;
    void show(`${top.title} ${top.hint}`, tr("action.showOutput")).then((choice) => {
      if (choice === tr("action.showOutput")) {
        output.show(true);
      }
    });
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
    return {
      projectDir: project.projectDir,
      testTarget: project.testTarget,
      discoveryRoot: discoveryRoot(project, roots),
      label: project.label,
    };
  }

  function getDiscoveryRoot(): string | undefined {
    return getProjectContext()?.discoveryRoot;
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

    if (!settings.projectPath.trim()) {
      await context.workspaceState.update(PROJECT_KEY, toStoredSelection(picked.project));
    }
    refreshAll();
    refreshUi();
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
}

export function deactivate(): void {
  // no-op
}

function readSettings(): RunnerSettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  const stage = cfg.get<string>("defaultStage", DEFAULT_SETTINGS.defaultStage);
  const mode = cfg.get<string>("defaultMode", DEFAULT_SETTINGS.defaultMode);
  const confirmStages = cfg
    .get<string[]>("requireConfirmationForStages", DEFAULT_SETTINGS.requireConfirmationForStages)
    .filter(isStage);
  return {
    projectPath: cfg.get<string>("projectPath", DEFAULT_SETTINGS.projectPath),
    defaultStage: isStage(stage) ? stage : DEFAULT_SETTINGS.defaultStage,
    defaultMode: isMode(mode) ? mode : DEFAULT_SETTINGS.defaultMode,
    requireConfirmationForStages: confirmStages as Stage[],
    dotnetPath: cfg.get<string>("dotnetPath", DEFAULT_SETTINGS.dotnetPath),
    filterMapping: readFilterMapping(cfg),
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
