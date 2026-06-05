import * as vscode from "vscode";
import { ParallelismMode, Stage } from "../core/config/types";
import { PilotLocale, t } from "../core/i18n";

export interface StatusBarActivity {
  running: boolean;
  /** When true, cancel command is hidden and debug-stop tooltip is shown. */
  debugging?: boolean;
}

/**
 * Status bar: STAGE, parallelism mode, active test project, and optional run indicator.
 */
export class StatusBar implements vscode.Disposable {
  private readonly stageItem: vscode.StatusBarItem;
  private readonly modeItem: vscode.StatusBarItem;
  private readonly runningItem: vscode.StatusBarItem;
  private readonly projectItem: vscode.StatusBarItem;

  constructor() {
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
    projectLabel?: string,
    activity?: StatusBarActivity,
  ): void {
    const isProtected = stage === "stg" || stage === "prod";
    this.stageItem.text = `$(globe) ${t(locale, "statusBar.stageLabel")}: ${stage}`;
    this.stageItem.tooltip = t(locale, "statusBar.stageTooltip");
    this.stageItem.backgroundColor = isProtected
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.stageItem.show();

    this.modeItem.text = `$(server-process) ${t(locale, "statusBar.modeLabel")}: ${mode}`;
    this.modeItem.tooltip = t(locale, "statusBar.modeTooltip");
    this.modeItem.show();

    if (activity?.running) {
      this.runningItem.text = `$(loading~spin) ${t(locale, "statusBar.running")}`;
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
      this.projectItem.tooltip = t(locale, "statusBar.projectTooltip");
      this.projectItem.backgroundColor = undefined;
      this.projectItem.show();
    } else {
      this.projectItem.text = `$(folder) ${t(locale, "statusBar.projectNotSet")}`;
      this.projectItem.tooltip = t(locale, "statusBar.projectMissingTooltip");
      this.projectItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.projectItem.show();
    }
  }

  dispose(): void {
    this.stageItem.dispose();
    this.modeItem.dispose();
    this.runningItem.dispose();
    this.projectItem.dispose();
  }
}
