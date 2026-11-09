import * as vscode from "vscode";
import {
  CompactStatusBarInput,
  formatCompactStatusBarLabel,
  formatCompactStatusBarTooltip,
  formatDetailedRunningLabel,
  formatDetailedStageTooltip,
  StatusBarDisplayMode,
  statusBarNeedsWarning,
} from "../core/config/statusBarViewModel";
import { StageEnvFileStatus } from "../core/config/envFile";
import { ParallelismMode, Stage } from "../core/config/types";
import { PilotLocale, t } from "../core/i18n";

export interface StatusBarActivity {
  running: boolean;
  /** When true, cancel command is hidden and debug-stop tooltip is shown. */
  debugging?: boolean;
  /** When true, the user selected a solution — show slower-run hint in project tooltip. */
  solutionSelected?: boolean;
}

const HUB_COMMAND = "bddPilot.openStatusBarHub";

/**
 * Status bar: compact branded hub (default) or legacy detailed items.
 */
export class StatusBar implements vscode.Disposable {
  private readonly hubItem: vscode.StatusBarItem;
  private readonly stageItem: vscode.StatusBarItem;
  private readonly modeItem: vscode.StatusBarItem;
  private readonly runningItem: vscode.StatusBarItem;
  private readonly projectItem: vscode.StatusBarItem;
  private liveCount: string | undefined;
  private displayMode: StatusBarDisplayMode = "compact";
  private lastStage: Stage | undefined;
  private lastMode: ParallelismMode | undefined;
  private lastLocale: PilotLocale | undefined;
  private lastProjectLabel: string | undefined;
  private lastActivity: StatusBarActivity | undefined;
  private lastEnvStatus: StageEnvFileStatus | undefined;
  private lastRunFlagsSummary: string | undefined;

  constructor() {
    this.hubItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.hubItem.command = HUB_COMMAND;
    this.stageItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.stageItem.command = "bddPilot.selectStage";
    this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.modeItem.command = "bddPilot.selectMode";
    this.runningItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.runningItem.command = "bddPilot.cancel";
    this.projectItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    this.projectItem.command = "bddPilot.selectProject";
  }

  update(
    stage: Stage,
    mode: ParallelismMode,
    locale: PilotLocale,
    projectLabel: string | undefined,
    activity: StatusBarActivity | undefined,
    displayMode: StatusBarDisplayMode,
    envStatus?: StageEnvFileStatus,
    runFlagsSummary?: string,
  ): void {
    this.displayMode = displayMode;
    this.lastStage = stage;
    this.lastMode = mode;
    this.lastLocale = locale;
    this.lastProjectLabel = projectLabel;
    this.lastActivity = activity;
    this.lastEnvStatus = envStatus;
    this.lastRunFlagsSummary = runFlagsSummary;
    if (!activity?.running || activity.debugging) {
      this.liveCount = undefined;
    }
    this.paint();
  }

  /** Live count for the current non-debug run. Does not rebuild the rest of the UI. */
  setLiveCount(count: string | undefined): void {
    if (!this.lastActivity?.running || this.lastActivity.debugging) {
      this.liveCount = undefined;
    } else {
      this.liveCount = count;
    }
    if (this.lastStage !== undefined && this.lastMode !== undefined && this.lastLocale !== undefined) {
      this.paint();
    }
  }

  private paint(): void {
    if (
      this.lastStage === undefined ||
      this.lastMode === undefined ||
      this.lastLocale === undefined
    ) {
      return;
    }
    if (this.displayMode === "compact") {
      this.updateCompact(
        this.lastStage,
        this.lastMode,
        this.lastLocale,
        this.lastProjectLabel,
        this.lastActivity,
        this.lastEnvStatus,
        this.lastRunFlagsSummary,
      );
      this.hideDetailed();
      return;
    }
    this.hubItem.hide();
    this.updateDetailed(
      this.lastStage,
      this.lastMode,
      this.lastLocale,
      this.lastProjectLabel,
      this.lastActivity,
      this.lastEnvStatus,
    );
  }

  private updateCompact(
    stage: Stage,
    mode: ParallelismMode,
    locale: PilotLocale,
    projectLabel: string | undefined,
    activity?: StatusBarActivity,
    envStatus?: StageEnvFileStatus,
    runFlagsSummary?: string,
  ): void {
    const input: CompactStatusBarInput = {
      stage,
      mode,
      locale,
      projectLabel,
      running: activity?.running,
      liveCount: activity?.debugging ? undefined : this.liveCount,
      solutionSelected: activity?.solutionSelected,
      debugging: activity?.debugging,
      envStatus,
      runFlagsSummary,
    };
    this.hubItem.text = formatCompactStatusBarLabel(input);
    this.hubItem.tooltip = formatCompactStatusBarTooltip(input);
    this.hubItem.backgroundColor = statusBarNeedsWarning(stage, projectLabel)
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.hubItem.show();
  }

  private updateDetailed(
    stage: Stage,
    mode: ParallelismMode,
    locale: PilotLocale,
    projectLabel: string | undefined,
    activity?: StatusBarActivity,
    envStatus?: StageEnvFileStatus,
  ): void {
    const isProtected = stage === "stg" || stage === "prod";
    this.stageItem.text = `$(globe) ${t(locale, "statusBar.stageLabel")}: ${stage}`;
    this.stageItem.tooltip = formatDetailedStageTooltip(locale, envStatus);
    this.stageItem.backgroundColor = isProtected
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.stageItem.show();

    this.modeItem.text = `$(server-process) ${t(locale, "statusBar.modeLabel")}: ${mode}`;
    this.modeItem.tooltip = t(locale, "statusBar.modeTooltip");
    this.modeItem.show();

    if (activity?.running) {
      this.runningItem.text = formatDetailedRunningLabel(
        locale,
        activity.debugging ? undefined : this.liveCount,
      );
      this.runningItem.tooltip = activity.debugging
        ? t(locale, "statusBar.debugRunningTooltip")
        : t(locale, "statusBar.runningTooltip");
      this.runningItem.command = activity.debugging ? undefined : "bddPilot.cancel";
      this.runningItem.show();
    } else {
      this.runningItem.hide();
    }

    if (projectLabel) {
      this.projectItem.text = `$(folder) ${projectLabel}`;
      const baseTooltip = t(locale, "statusBar.projectTooltip");
      this.projectItem.tooltip = activity?.solutionSelected
        ? `${baseTooltip}\n${t(locale, "statusBar.solutionSlowHint")}`
        : baseTooltip;
      this.projectItem.backgroundColor = undefined;
      this.projectItem.show();
    } else {
      this.projectItem.text = `$(folder) ${t(locale, "statusBar.projectNotSet")}`;
      this.projectItem.tooltip = t(locale, "statusBar.projectMissingTooltip");
      this.projectItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.projectItem.show();
    }
  }

  private hideDetailed(): void {
    this.stageItem.hide();
    this.modeItem.hide();
    this.runningItem.hide();
    this.projectItem.hide();
  }

  dispose(): void {
    this.hubItem.dispose();
    this.stageItem.dispose();
    this.modeItem.dispose();
    this.runningItem.dispose();
    this.projectItem.dispose();
  }
}
