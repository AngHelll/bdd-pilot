import * as path from "path";
import * as vscode from "vscode";
import { ExecutionProfile } from "./core/config/profiles";
import { resolveProjectDir } from "./core/config/projectLocator";
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
import { RunHistoryEntry } from "./core/results/runHistory";
import { RunTarget } from "./core/runner/filterBuilder";
import { analyzeDotnetOutput } from "./core/diagnostics/analyzer";
import { registerFeatureCodeLens } from "./providers/codeLensProvider";
import { DashboardPanel } from "./providers/dashboardPanel";
import { ProfileStore } from "./providers/profileStore";
import { RunService } from "./providers/runService";
import { StatusBar } from "./providers/statusBar";
import {
  DomainNode,
  FeatureNode,
  ScenarioNode,
  TestTreeProvider,
  TreeNode,
} from "./providers/testTreeProvider";
import { buildRerunFailedFilter, createManagedController } from "./providers/testController";

const STAGE_KEY = "bddPilot.stage";
const MODE_KEY = "bddPilot.mode";
const HISTORY_KEY = "bddPilot.runHistory";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("BDD Pilot");
  const statusBar = new StatusBar();
  const profileStore = new ProfileStore(context);
  const dashboard = new DashboardPanel();

  let currentStage: Stage = readStoredStage(context) ?? readSettings().defaultStage;
  let currentMode: ParallelismMode = readStoredMode(context) ?? readSettings().defaultMode;
  let activeRun: AbortController | undefined;

  const runService = new RunService(() =>
    context.workspaceState.get<RunHistoryEntry[]>(HISTORY_KEY, []),
  );

  const treeProvider = new TestTreeProvider(() => getProjectDir());
  const treeView = vscode.window.createTreeView("bddPilot.tests", {
    treeDataProvider: treeProvider,
  });

  const persistHistory = () => {
    void context.workspaceState.update(HISTORY_KEY, runService.getHistory());
    dashboard.update(runService.getHistory());
  };

  runService.onHistoryChanged(() => persistHistory());

  const managed = createManagedController({
    getProjectDir: () => getProjectDir(),
    getStage: () => currentStage,
    getMode: () => currentMode,
    getSettings: () => readSettings(),
    output,
    runService,
    onResultsApplied: (summary) => treeProvider.applyResults(summary),
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
  };

  const refreshUi = () => {
    statusBar.update(currentStage, currentMode);
    void vscode.commands.executeCommand("setContext", "bddPilot.running", !!activeRun);
  };

  refreshAll();
  refreshUi();

  context.subscriptions.push(
    output,
    statusBar,
    treeView,
    managed.controller,
    registerFeatureCodeLens(),

    vscode.commands.registerCommand("bddPilot.refresh", () => refreshAll()),

    vscode.commands.registerCommand("bddPilot.showOutput", () => output.show(true)),

    vscode.commands.registerCommand("bddPilot.showDashboard", () => {
      dashboard.show(runService.getHistory());
    }),

    vscode.commands.registerCommand("bddPilot.searchTests", async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: "Filter by name, tag (@Smoke), or path…",
        prompt: "Leave empty to clear the filter",
      });
      if (query !== undefined) {
        treeProvider.setSearchQuery(query);
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectStage", async () => {
      const picked = await vscode.window.showQuickPick(ALL_STAGES, {
        placeHolder: `Current: ${currentStage}. Select environment (STAGE)`,
      });
      if (picked && isStage(picked)) {
        currentStage = picked;
        await context.workspaceState.update(STAGE_KEY, picked);
        refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectMode", async () => {
      const picked = await vscode.window.showQuickPick(ALL_MODES, {
        placeHolder: `Current: ${currentMode}. Select parallelism mode`,
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
        void vscode.window.showInformationMessage("No test run is currently active.");
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
      const filter = buildRerunFailedFilter(runService);
      if (!filter) {
        void vscode.window.showInformationMessage("No failed tests from the last run to re-run.");
        return;
      }
      await executeRun({ kind: "all" }, { rawFilter: filter });
    }),

    vscode.commands.registerCommand("bddPilot.saveProfile", async () => {
      const name = await vscode.window.showInputBox({ prompt: "Profile name" });
      if (!name) {
        return;
      }
      const filter = await vscode.window.showInputBox({
        prompt: "Filter expression",
        placeHolder: "Category=Smoke or FullyQualifiedName~LoginFeature",
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
      void vscode.window.showInformationMessage(`Saved profile "${name}".`);
    }),

    vscode.commands.registerCommand("bddPilot.runProfile", async () => {
      const profiles = profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage("No saved profiles. Use 'Save Execution Profile' first.");
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, profile: p })),
        { placeHolder: "Select an execution profile" },
      );
      if (picked) {
        await executeRun({ kind: "all" }, { rawFilter: picked.profile.filter });
      }
    }),

    vscode.commands.registerCommand("bddPilot.manageProfiles", async () => {
      const profiles = profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage("No saved profiles.");
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, id: p.id })),
        { placeHolder: "Select a profile to delete" },
      );
      if (picked) {
        await profileStore.remove(picked.id);
        void vscode.window.showInformationMessage(`Removed profile "${picked.label}".`);
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bddPilot")) {
        refreshAll();
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
    if (node.kind === "feature") {
      return { kind: "feature", feature: (node as FeatureNode).feature };
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
      void vscode.window.showWarningMessage("A test run is already in progress.");
      return;
    }

    const settings = readSettings();
    const projectDir = getProjectDir();
    if (!projectDir) {
      void vscode.window.showErrorMessage(
        "BDD Pilot: could not locate the .NET test project. Set 'bddPilot.projectPath'.",
      );
      return;
    }

    const runTargets = opts?.rawFilter ? [] : normalizeTargets(target);

    const controller = new AbortController();
    if (!opts?.debug) {
      activeRun = controller;
      refreshUi();
      output.clear();
      output.show(true);
      treeProvider.clearResults();

      const loadedEnv = loadStageEnv(projectDir, currentStage);
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
          ? `Debugging tests (${currentStage})`
          : `Running tests (${currentStage}/${currentMode})`,
        cancellable: !opts?.debug,
      },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort());
        try {
          const result = await runService.run({
            targets: runTargets,
            rawFilter: opts?.rawFilter,
            stage: currentStage,
            mode: currentMode,
            settings,
            projectDir,
            debug: opts?.debug,
            signal: controller.signal,
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
    void show(`${top.title} ${top.hint}`, "Show Output").then((choice) => {
      if (choice === "Show Output") {
        output.show(true);
      }
    });
  }

  function getProjectDir(): string | undefined {
    const settings = readSettings();
    const roots = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    return resolveProjectDir(roots, settings.projectPath);
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
