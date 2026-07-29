import * as vscode from "vscode";
import {
  discoveryRoot,
  expandDirectoryAmbiguity,
  listSelectableProjects,
  resolveExecutionTarget,
  resolveProject,
  ResolvedProject,
  StoredProjectSelection,
  toStoredSelection,
} from "../core/config/projectResolution";
import { discoverProjectCandidates } from "../core/config/projectLocator";
import {
  buildHubCancelPickItem,
  buildModeHubPickItems,
  buildStageHubPickItems,
  prependHubCancelIfBusy,
} from "../core/config/hubPickItems";
import { ParallelismMode, Stage, isMode, isStage } from "../core/config/types";
import { MessageKey } from "../core/i18n";
import { OutcomeStore } from "../providers/outcomeStore";
import { ProjectContext } from "../providers/testController";
import { LocaleService } from "../providers/localeService";
import { readSettings } from "./extensionSettings";
import { MODE_KEY, PROJECT_KEY, STAGE_KEY } from "./storageKeys";

export interface ProjectHubDeps {
  context: vscode.ExtensionContext;
  localeService: LocaleService;
  outcomeStore: OutcomeStore;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  getStage: () => Stage;
  setStage: (stage: Stage) => void;
  getMode: () => ParallelismMode;
  setMode: (mode: ParallelismMode) => void;
  refreshAll: (immediateEnrich?: boolean) => void;
  refreshUi: () => void;
  refreshPilotSurfaces: () => void;
  tryRehydrateOutcomes: () => void;
  /** Same busy source as tree badge / bddPilot.running. */
  isRunActive: () => boolean;
}

export function createProjectHub(deps: ProjectHubDeps) {
  function getWorkspaceRoots(): string[] {
    return (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  }

  function readStoredProject(): StoredProjectSelection | undefined {
    return deps.context.workspaceState.get<StoredProjectSelection>(PROJECT_KEY);
  }

  function getResolvedProject(): ResolvedProject | undefined {
    const settings = readSettings();
    const roots = getWorkspaceRoots();
    return resolveProject(roots, settings.projectPath, readStoredProject());
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
      await deps.context.workspaceState.update(PROJECT_KEY, toStoredSelection(project));
    }
    deps.refreshAll();
    deps.refreshUi();
    const newProjectDir = getProjectContext()?.projectDir;
    if (newProjectDir && newProjectDir !== previousProjectDir) {
      deps.outcomeStore.clearAll();
      deps.tryRehydrateOutcomes();
      deps.refreshPilotSurfaces();
    }
  }

  async function openStatusBarHub(): Promise<void> {
    type HubPick = vscode.QuickPickItem & {
      hubKind?: "cancel" | "stage" | "mode" | "project";
      hubValue?: string;
      project?: ResolvedProject;
    };

    const currentStage = deps.getStage();
    const currentMode = deps.getMode();
    const locale = deps.localeService.getLocale();
    const baseItems: HubPick[] = [
      { label: deps.tr("statusBar.hubSectionStage"), kind: vscode.QuickPickItemKind.Separator },
      ...buildStageHubPickItems(currentStage, locale).map((item) => ({
        label: item.label,
        description: item.description,
        hubKind: "stage" as const,
        hubValue: item.value,
      })),
      { label: deps.tr("statusBar.hubSectionMode"), kind: vscode.QuickPickItemKind.Separator },
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
      baseItems.push({ label: deps.tr("statusBar.hubSectionProject"), kind: vscode.QuickPickItemKind.Separator });
      const currentLabel = getProjectContext()?.label;
      for (const project of projects) {
        baseItems.push({
          label: project.label === currentLabel ? `$(check) ${project.label}` : project.label,
          description: project.kind === "sln" ? deps.tr("quickPick.solution") : project.projectDir,
          hubKind: "project",
          project,
        });
      }
    }

    const cancelSpec = buildHubCancelPickItem(locale);
    const cancelItem: HubPick = {
      label: cancelSpec.label,
      description: cancelSpec.description,
      hubKind: "cancel",
    };
    const items = prependHubCancelIfBusy(baseItems, deps.isRunActive(), cancelItem);

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: deps.tr("statusBar.hubTooltipTitle"),
      matchOnDescription: true,
    });
    if (!picked?.hubKind) {
      return;
    }

    if (picked.hubKind === "cancel") {
      await vscode.commands.executeCommand("bddPilot.cancel");
      return;
    }

    if (picked.hubKind === "stage" && picked.hubValue && isStage(picked.hubValue)) {
      deps.setStage(picked.hubValue);
      await deps.context.workspaceState.update(STAGE_KEY, picked.hubValue);
      deps.refreshUi();
      return;
    }

    if (picked.hubKind === "mode" && picked.hubValue && isMode(picked.hubValue)) {
      deps.setMode(picked.hubValue);
      await deps.context.workspaceState.update(MODE_KEY, picked.hubValue);
      deps.refreshUi();
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
      void vscode.window.showWarningMessage(deps.tr("toast.noProjectsFound"));
      return undefined;
    }

    const picked = await vscode.window.showQuickPick(
      items.map((p) => ({
        label: p.label,
        description: p.kind === "sln" ? deps.tr("quickPick.solution") : p.projectDir,
        project: p,
      })),
      { placeHolder: deps.tr("prompt.selectProject") },
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
    if (readStoredProject()) {
      return;
    }
    const selectProjectLabel = deps.tr("action.selectProject");
    void vscode.window
      .showInformationMessage(deps.tr("toast.multiProjectPrompt"), selectProjectLabel)
      .then((choice) => {
        if (choice === selectProjectLabel) {
          void selectProject();
        }
      });
  }

  return {
    getWorkspaceRoots,
    getResolvedProject,
    getProjectContext,
    getDiscoveryRoot,
    applyProjectSelection,
    openStatusBarHub,
    selectProject,
    maybePromptProjectSelection,
  };
}

export type ProjectHub = ReturnType<typeof createProjectHub>;
