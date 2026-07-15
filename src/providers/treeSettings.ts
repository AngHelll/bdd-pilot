import * as vscode from "vscode";
import {
  parseTreeDisplaySettings,
  parseTreeGroupBy,
  TreeDisplaySettings,
  TreeGroupBy,
} from "../core/gherkin/treeDisplaySettings";

export type { TreeDisplaySettings, TreeGroupBy };

export function readTreeGroupBy(): TreeGroupBy {
  const raw = vscode.workspace.getConfiguration("bddPilot").get<string>("tree.groupBy", "domain");
  return parseTreeGroupBy(raw);
}

export function readTreeDisplaySettings(): TreeDisplaySettings {
  const cfg = vscode.workspace.getConfiguration("bddPilot");
  return parseTreeDisplaySettings({
    displayMode: cfg.get<string>("tree.displayMode"),
    tagDisplay: cfg.get<string>("tree.tagDisplay"),
    compactTagLimit: cfg.get<number>("tree.compactTagLimit"),
    durationDisplay: cfg.get<string>("tree.durationDisplay"),
  });
}
