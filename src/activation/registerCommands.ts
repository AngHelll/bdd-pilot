import * as path from "path";
import * as vscode from "vscode";
import { ExecutionProfile } from "../core/config/profiles";
import { buildModeHubPickItems, buildStageHubPickItems } from "../core/config/hubPickItems";
import { ParallelismMode, Stage, isMode, isStage } from "../core/config/types";
import { shouldConfirmSearchRunCap } from "../core/gherkin/treeSearch";
import { RunTarget } from "../core/runner/filterBuilder";
import { MessageKey } from "../core/i18n";
import { getLastMappingReport } from "../core/results/lastMappingReport";
import {
  buildScenarioHistoryView,
  formatScenarioHistoryPickLabel,
} from "../core/results/scenarioHistoryView";
import { scenarioHistoryKey } from "../core/results/runHistory";
import { formatDuration } from "../core/results/durationFormat";
import {
  containerKeysToExpandForFailures,
  findFirstFailedLeaf,
} from "../core/results/failureTreeNav";
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

async function openFeatureAtLine(featurePath: string, line: number): Promise<void> {
  const uri = vscode.Uri.file(featurePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const openLine = Math.max(0, line - 1);
  const position = new vscode.Position(openLine, 0);
  const range = new vscode.Range(position, position);
  const editor = await vscode.window.showTextDocument(doc, { selection: range });
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}

export interface RegisterCommandsDeps {
  context: vscode.ExtensionContext;
  output: vscode.OutputChannel;
  localeService: LocaleService;
  profileStore: ProfileStore;
  dashboard: DashboardPanel;
  runService: RunService;
  treeProvider: TestTreeProvider;
  treeView: vscode.TreeView<TreeNode>;
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

    vscode.commands.registerCommand("bddPilot.jumpToFirstFailure", async () => {
      const leaf = findFirstFailedLeaf(
        deps.treeProvider.getDomains(),
        deps.treeProvider.getOutcomeStore(),
      );
      if (!leaf) {
        void vscode.window.showInformationMessage(deps.tr("toast.noFailedScenarios"));
        return;
      }
      const node = deps.treeProvider.findLeafNodeByOutcomeKey(leaf.outcomeKey);
      if (node) {
        try {
          await deps.treeView.reveal(node, { select: true, focus: true, expand: true });
        } catch {
          // Tree may be filtered/empty — still open the feature.
        }
      }
      try {
        await openFeatureAtLine(leaf.featurePath, leaf.scenarioLine);
      } catch {
        void vscode.window.showWarningMessage(deps.tr("toast.unmappedOpenFailed"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.collapseToFailures", async () => {
      const domains = deps.treeProvider.getDomains();
      const store = deps.treeProvider.getOutcomeStore();
      const containers = containerKeysToExpandForFailures(domains, store);
      if (containers.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.noFailedScenariosFocus"));
        return;
      }
      try {
        await vscode.commands.executeCommand(
          "workbench.actions.treeView.bddPilot.tests.collapseAll",
        );
      } catch {
        // Command id can vary by host; continue with expands.
      }
      for (const container of containers) {
        let node: TreeNode | undefined;
        if (container.kind === "domain") {
          node = deps.treeProvider.findDomainNode(container.id);
        } else if (container.kind === "feature") {
          node = deps.treeProvider.findFeatureNode(container.id);
        } else {
          const featurePath = container.id.split("::")[0];
          node = deps.treeProvider.findScenarioOutlineNode(featurePath, container.id);
        }
        if (node) {
          try {
            await deps.treeView.reveal(node, { expand: true, select: false, focus: false });
          } catch {
            // ignore expand failures for filtered nodes
          }
        }
      }
      const first = findFirstFailedLeaf(domains, store);
      if (first) {
        const leafNode = deps.treeProvider.findLeafNodeByOutcomeKey(first.outcomeKey);
        if (leafNode) {
          try {
            await deps.treeView.reveal(leafNode, { expand: true, select: true, focus: true });
          } catch {
            // ignore
          }
        }
      }
    }),

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

    vscode.commands.registerCommand("bddPilot.showUnmappedScenarios", async () => {
      const report = getLastMappingReport();
      if (!report || report.unmapped <= 0 || report.unmappedLeaves.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("toast.noUnmappedScenarios"));
        return;
      }
      const picks = report.unmappedLeaves.map((leaf) => {
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(leaf.featurePath));
        const rel = folder
          ? path.relative(folder.uri.fsPath, leaf.featurePath)
          : leaf.featurePath;
        const label = leaf.outlineLabel
          ? `${leaf.scenarioName} · ${leaf.outlineLabel}`
          : leaf.scenarioName;
        return {
          label,
          description: rel,
          leaf,
        };
      });
      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: deps.tr("quickPick.unmappedPlaceholder"),
        matchOnDescription: true,
      });
      if (!selected) {
        return;
      }
      try {
        const uri = vscode.Uri.file(selected.leaf.featurePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const line = Math.max(0, selected.leaf.line - 1);
        const position = new vscode.Position(line, 0);
        const range = new vscode.Range(position, position);
        const editor = await vscode.window.showTextDocument(doc, { selection: range });
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch {
        void vscode.window.showWarningMessage(deps.tr("toast.unmappedOpenFailed"));
      }
    }),

    vscode.commands.registerCommand("bddPilot.showScenarioHistory", async (node?: TreeNode) => {
      if (!node || (node.kind !== "scenario" && node.kind !== "outlineRow")) {
        void vscode.window.showInformationMessage(deps.tr("toast.scenarioHistoryNeedLeaf"));
        return;
      }
      const featurePath = node.feature.filePath;
      const scenarioName = node.scenario.name;
      const line = node.kind === "outlineRow" ? node.example.line : node.scenario.line;
      const nameForKey =
        node.kind === "outlineRow"
          ? `${node.scenario.name} · ${node.example.label}`
          : node.scenario.name;
      const key = scenarioHistoryKey(featurePath, line, nameForKey);
      const view = buildScenarioHistoryView(deps.runService.getHistory(), key, {
        featurePath,
        scenarioName,
      });
      if (view.rows.length === 0) {
        void vscode.window.showInformationMessage(deps.tr("scenarioHistory.empty"));
        return;
      }
      if (view.usedParentFallback) {
        void vscode.window.showInformationMessage(deps.tr("scenarioHistory.parentNote"));
      }
      const picks = [
        {
          label: `$(file) ${deps.tr("scenarioHistory.openFeature")}`,
          description: path.basename(view.featurePath),
          action: "open" as const,
        },
        ...view.rows.map((row) => ({
          label: formatScenarioHistoryPickLabel(row),
          description: row.durationMs !== undefined ? formatDuration(row.durationMs, "auto") : undefined,
          detail: row.errorSnippet,
          action: "noop" as const,
          row,
        })),
      ];
      const selected = await vscode.window.showQuickPick(picks, {
        title: deps.tr("scenarioHistory.title", { name: view.scenarioName }),
        placeHolder: deps.tr("scenarioHistory.placeholder"),
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (!selected || selected.action !== "open") {
        return;
      }
      try {
        const uri = vscode.Uri.file(view.featurePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const openLine = Math.max(0, (view.scenarioLine || line) - 1);
        const position = new vscode.Position(openLine, 0);
        const range = new vscode.Range(position, position);
        const editor = await vscode.window.showTextDocument(doc, { selection: range });
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      } catch {
        void vscode.window.showWarningMessage(deps.tr("toast.unmappedOpenFailed"));
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
