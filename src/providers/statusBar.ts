import * as vscode from "vscode";
import { ParallelismMode, Stage } from "../core/config/types";

/**
 * Two status bar items: the active STAGE and the parallelism mode. Clicking
 * either opens the corresponding picker command.
 */
export class StatusBar implements vscode.Disposable {
  private readonly stageItem: vscode.StatusBarItem;
  private readonly modeItem: vscode.StatusBarItem;

  constructor() {
    this.stageItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.stageItem.command = "bddPilot.selectStage";
    this.modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.modeItem.command = "bddPilot.selectMode";
  }

  update(stage: Stage, mode: ParallelismMode): void {
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
  }

  dispose(): void {
    this.stageItem.dispose();
    this.modeItem.dispose();
  }
}
