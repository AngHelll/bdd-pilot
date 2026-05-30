import * as vscode from "vscode";
import { ParallelismMode, Stage } from "../core/config/types";

/**
 * Status bar: STAGE, parallelism mode, and active test project.
 */
export class StatusBar implements vscode.Disposable {
  private readonly stageItem: vscode.StatusBarItem;
  private readonly modeItem: vscode.StatusBarItem;
  private readonly projectItem: vscode.StatusBarItem;

  constructor() {
    this.stageItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.stageItem.command = "bddPilot.selectStage";
    this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.modeItem.command = "bddPilot.selectMode";
    this.projectItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.projectItem.command = "bddPilot.selectProject";
  }

  update(stage: Stage, mode: ParallelismMode, projectLabel?: string): void {
    const isProtected = stage === "stg" || stage === "prod";
    this.stageItem.text = `$(globe) STAGE: ${stage}`;
    this.stageItem.tooltip = "BDD Pilot: select environment";
    this.stageItem.backgroundColor = isProtected
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
    this.stageItem.show();

    this.modeItem.text = `$(server-process) mode: ${mode}`;
    this.modeItem.tooltip = "BDD Pilot: select parallelism mode";
    this.modeItem.show();

    if (projectLabel) {
      this.projectItem.text = `$(folder) ${projectLabel}`;
      this.projectItem.tooltip = "BDD Pilot: select test project or solution";
      this.projectItem.show();
    } else {
      this.projectItem.text = "$(folder) project: (not set)";
      this.projectItem.tooltip = "BDD Pilot: select test project — multiple or none detected";
      this.projectItem.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      this.projectItem.show();
    }
  }

  dispose(): void {
    this.stageItem.dispose();
    this.modeItem.dispose();
    this.projectItem.dispose();
  }
}
