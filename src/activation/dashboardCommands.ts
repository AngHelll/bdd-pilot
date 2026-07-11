import * as vscode from "vscode";
import { DashboardWebviewCommand, buildRerunFilterFromHistoryEntry } from "../core/results/dashboardActions";
import { resolveFlakyFeaturePath } from "../core/results/flakyDashboard";
import { RunTarget } from "../core/runner/filterBuilder";
import { MessageKey } from "../core/i18n";
import { DashboardContext } from "../providers/dashboardPanel";
import { RunService } from "../providers/runService";
import { TestTreeProvider } from "../providers/testTreeProvider";
import { readSettings } from "./extensionSettings";

export type ExecuteRunFn = (
  target: RunTarget | RunTarget[],
  opts?: { debug?: boolean; rawFilter?: string },
) => Promise<void>;

export interface DashboardCommandsDeps {
  output: vscode.OutputChannel;
  runService: RunService;
  treeProvider: TestTreeProvider;
  tr: (key: MessageKey, params?: Record<string, string | number>) => string;
  buildDashboardContext: () => DashboardContext;
  copyFailureContextForAi: () => Promise<void>;
  executeRun: ExecuteRunFn;
}

export function createDashboardCommands(deps: DashboardCommandsDeps) {
  async function openFlakyScenario(target: {
    featurePath: string;
    scenarioLine: number;
  }): Promise<void> {
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
      void vscode.window.showWarningMessage(deps.tr("dashboard.flakyOpenFailed"));
    }
  }

  async function handleDashboardCommand(command: DashboardWebviewCommand): Promise<void> {
    const ctx = deps.buildDashboardContext();
    const target = ctx.actions?.target;
    switch (command) {
      case "showOutput":
        deps.output.show(true);
        return;
      case "copyForAi":
        await deps.copyFailureContextForAi();
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
        const entry = deps.runService.getHistory().find((e) => e.id === target.entryId);
        if (!entry) {
          return;
        }
        const filter = buildRerunFilterFromHistoryEntry(
          entry,
          readSettings().filterMapping,
          deps.treeProvider.getDomains(),
        );
        if (!filter) {
          void vscode.window.showInformationMessage(deps.tr("toast.noFailedRerun"));
          return;
        }
        await deps.executeRun({ kind: "all" }, { rawFilter: filter });
        return;
      }
    }
  }

  return { handleDashboardCommand, openFlakyScenario };
}

export type DashboardCommands = ReturnType<typeof createDashboardCommands>;
