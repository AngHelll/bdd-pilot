import * as vscode from "vscode";
import {
  parseTreeDisplaySettings,
  parseTreeGroupBy,
  TreeDisplaySettings,
  TreeGroupBy,
} from "../core/gherkin/treeDisplaySettings";
import {
  DEFAULT_TREE_PRESENTATION,
  parseTreePresentation,
  TreePresentation,
} from "../core/gherkin/treePresentation";

export type { TreeDisplaySettings, TreeGroupBy, TreePresentation };

export function readTreeGroupBy(): TreeGroupBy {
  const raw = vscode.workspace.getConfiguration("bddPilot").get<string>("tree.groupBy", "domain");
  return parseTreeGroupBy(raw);
}

export function readTreePresentation(): TreePresentation {
  const raw = vscode.workspace.getConfiguration("bddPilot").get<string>(
    "tree.presentation",
    DEFAULT_TREE_PRESENTATION,
  );
  return parseTreePresentation(raw);
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
