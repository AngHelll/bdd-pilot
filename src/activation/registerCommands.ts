import * as vscode from "vscode";
import { ExecutionProfile } from "../core/config/profiles";
import { buildModeHubPickItems, buildStageHubPickItems } from "../core/config/hubPickItems";
import { ParallelismMode, Stage, isMode, isStage } from "../core/config/types";
import { shouldConfirmSearchRunCap } from "../core/gherkin/treeSearch";
import { RunTarget } from "../core/runner/filterBuilder";
import { MessageKey } from "../core/i18n";
import { buildRerunFailedFilter } from "../providers/testController";
import { BDD_PILOT_DEBUG_SESSION_NAME } from "../providers/runService";
import { DashboardPanel } from "../providers/dashboardPanel";
import { LocaleService } from "../providers/localeService";
import { ProfileStore } from "../providers/profileStore";
import { RunService } from "../providers/runService";
import { TestTreeProvider, TreeNode } from "../providers/testTreeProvider";
import { DashboardContext } from "../providers/dashboardPanel";
import {
  readAiSettings,
  readSearchRunCap,
  readSettings,
} from "./extensionSettings";
import { MODE_KEY, STAGE_KEY } from "./storageKeys";
import { ExecuteRunFn } from "./dashboardCommands";
import { toRunTarget } from "./runTargets";

export interface RegisterCommandsDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  localeService: LocaleService;
  profileStore: ProfileStore;
  dashboard: DashboardPanel;
  runService: RunService;
  treeProvider: TestTreeProvider;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  getStage: () => Stage;
  setStage: (stage: Stage) => void;
  getMode: () => ParallelismMode;
  setMode: (mode: ParallelismMode) => void;
  getActiveRun: () => AbortController | undefined;
  abortActiveRun: () => void;
  refreshAll: (immediateEnrich?: boolean) => void;
  refreshUi: () => void;
  refreshTreeSurfaces: () => void;
  scheduleEnrichTheoryRows: () => void;
  updateTreeGroupByContext: () => void;
  buildDashboardContext: () => DashboardContext;
  executeRun: ExecuteRunFn;
  selectProject: () => Promise<unknown>;
  openStatusBarHub: () => Promise<void>;
  copyFailureContextForAi: () => Promise<void>;
  handleDebugSessionEnded: () => void;
  cancelScheduledEnrich: () => void;
}

export function registerExtensionCommands(deps: RegisterCommandsDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("bddPilot.refresh", () => deps.refreshAll()),

    vscode.commands.registerCommand("bddPilot.showOutput", () => deps.output.show(true)),

    vscode.commands.registerCommand("bddPilot.copyFailureContextForAi", () => {
      if (!readAiSettings().enabled) {
        return;
      }
      void deps.copyFailureContextForAi();
    }),

    vscode.commands.registerCommand("bddPilot.showDashboard", () => {
      const history = deps.runService.getHistory();
      deps.dashboard.show(history, deps.localeService.getLocale(), deps.buildDashboardContext());
      if (history.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.dashboardEmpty"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.searchTests", async () => {
      const query = await vscode.window.showInputBox({
        value: deps.treeProvider.getSearchQuery(),
        placeHolder: deps.tr("prompt.searchFilter"),
        prompt: deps.tr("prompt.searchClear"),
      });
      if (query !== undefined) {
        deps.treeProvider.setSearchQuery(query);
      }
    }),

    vscode.commands.registerCommand("bddPilot.searchTestsActive", () => {
      void vscode.commands.executeCommand("bddPilot.searchTests");
    }),

    vscode.commands.registerCommand("bddPilot.clearSearch", () => {
      deps.treeProvider.setSearchQuery("");
    }),

    vscode.commands.registerCommand("bddPilot.runFiltered", async () => {
      const targets = deps.treeProvider.getFilteredRunTargets();
      if (targets.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.searchNoMatches"));
        return;
      }
      const cap = readSearchRunCap();
      if (shouldConfirmSearchRunCap(targets.length, cap)) {
        const runLabel = deps.tr("action.runFiltered");
        const choice = await vscode.window.showWarningMessage(
          deps.tr("toast.runFilteredConfirm", { count: targets.length }),
          { modal: true },
          runLabel,
        );
        if (choice !== runLabel) {
          return;
        }
      }
      await deps.executeRun(targets);
    }),

    vscode.commands.registerCommand("bddPilot.selectProject", () => deps.selectProject()),

    vscode.commands.registerCommand("bddPilot.openStatusBarHub", () => deps.openStatusBarHub()),

    vscode.commands.registerCommand("bddPilot.selectStage", async () => {
      const locale = deps.localeService.getLocale();
      const items = buildStageHubPickItems(deps.getStage(), locale);
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ label: item.label, description: item.description, value: item.value })),
        { placeHolder: deps.tr("prompt.selectStage", { current: deps.getStage() }) },
      );
      if (picked && isStage(picked.value)) {
        deps.setStage(picked.value);
        await deps.context.workspaceState.update(STAGE_KEY, picked.value);
        deps.refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.selectMode", async () => {
      const locale = deps.localeService.getLocale();
      const items = buildModeHubPickItems(deps.getMode(), locale);
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({ label: item.label, description: item.description, value: item.value })),
        { placeHolder: deps.tr("prompt.selectMode", { current: deps.getMode() }) },
      );
      if (picked && isMode(picked.value)) {
        deps.setMode(picked.value);
        await deps.context.workspaceState.update(MODE_KEY, picked.value);
        deps.refreshUi();
      }
    }),

    vscode.commands.registerCommand("bddPilot.cancel", () => {
      if (deps.getActiveRun()) {
        deps.abortActiveRun();
        deps.output.appendLine("\n[bdd-pilot] Cancellation requested...");
      } else {
        void vscode.window.showInformationMessage(deps.tr("toast.noActiveRun"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.runAll", async () => {
      await deps.executeRun({ kind: "all" });
    }),

    vscode.commands.registerCommand("bddPilot.runNode", async (node: TreeNode) => {
      const target = toRunTarget(node);
      if (target) {
        await deps.executeRun(target);
      }
    }),

    vscode.commands.registerCommand("bddPilot.debugNode", async (node: TreeNode) => {
      const target = toRunTarget(node);
      if (target) {
        await deps.executeRun(target, { debug: true });
      }
    }),

    vscode.commands.registerCommand("bddPilot.runFromCodeLens", async (target: RunTarget, debug?: boolean) => {
      await deps.executeRun(target, { debug: !!debug });
    }),

    vscode.commands.registerCommand("bddPilot.rerunFailed", async () => {
      const filter = buildRerunFailedFilter(deps.runService, readSettings().filterMapping);
      if (!filter) {
        void vscode.window.showInformationMessage(deps.tr("toast.noFailedRerun"));
        return;
      }
      await deps.executeRun({ kind: "all" }, { rawFilter: filter });
    }),

    vscode.commands.registerCommand("bddPilot.saveProfile", async () => {
      const name = await vscode.window.showInputBox({ prompt: deps.tr("prompt.profileName") });
      if (!name) {
        return;
      }
      const filter = await vscode.window.showInputBox({
        prompt: deps.tr("prompt.profileFilter"),
        placeHolder: deps.tr("prompt.profileFilterExample"),
      });
      if (!filter) {
        return;
      }
      const profile: ExecutionProfile = {
        id: `profile-${Date.now()}`,
        name,
        filter,
      };
      await deps.profileStore.save(profile);
      void vscode.window.showInformationMessage(deps.tr("toast.profileSaved", { name }));
    }),

    vscode.commands.registerCommand("bddPilot.runProfile", async () => {
      const profiles = deps.profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.noProfilesRun"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, profile: p })),
        { placeHolder: deps.tr("prompt.selectProfileRun") },
      );
      if (picked) {
        await deps.executeRun({ kind: "all" }, { rawFilter: picked.profile.filter, runKind: "profile" });
      }
    }),

    vscode.commands.registerCommand("bddPilot.manageProfiles", async () => {
      const profiles = deps.profileStore.list();
      if (profiles.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.noProfilesManage"));
        return;
      }
      const picked = await vscode.window.showQuickPick(
        profiles.map((p) => ({ label: p.name, description: p.filter, id: p.id })),
        { placeHolder: deps.tr("prompt.selectProfileDelete") },
      );
      if (picked) {
        await deps.profileStore.remove(picked.id);
        void vscode.window.showInformationMessage(deps.tr("toast.profileRemoved", { name: picked.label }));
      }
    }),

    vscode.commands.registerCommand("bddPilot.cycleTreeGroupBy", async () => {
      const cfg = vscode.workspace.getConfiguration("bddPilot");
      const current = cfg.get<string>("tree.groupBy", "domain");
      const next = current === "tag" ? "domain" : "tag";
      await cfg.update("tree.groupBy", next, vscode.ConfigurationTarget.Workspace);
      deps.updateTreeGroupByContext();
      void vscode.window.showInformationMessage(
        next === "tag" ? deps.tr("toast.treeGroupByTag") : deps.tr("toast.treeGroupByDomain"),
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
        deps.refreshAll();
        deps.refreshUi();
      }
    }),

    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.fileName.toLowerCase().endsWith(".feature")) {
        deps.refreshTreeSurfaces();
        deps.scheduleEnrichTheoryRows();
      }
    }),

    vscode.debug.onDidTerminateDebugSession((session) => {
      if (session.name === BDD_PILOT_DEBUG_SESSION_NAME) {
        deps.handleDebugSessionEnded();
      }
    }),
  ];
}
