import * as vscode from "vscode";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import { parseFeature } from "../core/gherkin/parser";
import { RunTarget } from "../core/runner/filterBuilder";

export type CodeLensRunHandler = (target: RunTarget, debug: boolean) => void | Promise<void>;

const FEATURE_LINE_RE = /^\s*(?:Feature|Característica|Funcionalidad)\s*:/i;

/**
 * Shows Run / Debug CodeLens on Feature, Scenario, and Scenario Outline example rows.
 */
export function registerFeatureCodeLens(): vscode.Disposable {
  const provider: vscode.CodeLensProvider = {
    provideCodeLenses(document) {
      if (!document.fileName.toLowerCase().endsWith(".feature")) {
        return [];
      }

      const text = document.getText();
      const feature = parseFeature(document.uri.fsPath, text);
      const lenses: vscode.CodeLens[] = [];
      const featureLine = findFeatureLine(text);

      if (featureLine >= 0) {
        lenses.push(...makeFeatureLenses(featureLine, feature, document.uri));
      }

      for (const scenario of feature.scenarios) {
        const range = lineRange(scenario.line);
        if (scenario.examples && scenario.examples.length > 0) {
          lenses.push(...makeScenarioLenses(range, feature, scenario, true));
          for (const example of scenario.examples) {
            lenses.push(...makeOutlineRowLenses(lineRange(example.line), feature, scenario, example));
          }
        } else {
          lenses.push(...makeScenarioLenses(range, feature, scenario, false));
        }
      }

      return lenses;
    },
  };

  return vscode.languages.registerCodeLensProvider({ pattern: "**/*.feature" }, provider);
}

function findFeatureLine(content: string): number {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (FEATURE_LINE_RE.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function lineRange(lineNumber: number): vscode.Range {
  const line = lineNumber - 1;
  return new vscode.Range(line, 0, line, 0);
}

function makeFeatureLenses(line: number, feature: FeatureInfo, uri: vscode.Uri): vscode.CodeLens[] {
  const range = new vscode.Range(line, 0, line, 0);
  const target: RunTarget = {
    kind: "feature",
    feature: { name: feature.name, filePath: uri.fsPath, tags: feature.tags, scenarios: [] },
  };
  return makeRunLenses(range, target, "$(play) Run", "$(debug) Debug");
}

function makeScenarioLenses(
  range: vscode.Range,
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  runAllRows: boolean,
): vscode.CodeLens[] {
  const target: RunTarget = {
    kind: "scenario",
    feature: stubFeature(feature),
    scenario: { ...scenario, examples: undefined },
  };
  const runTitle = runAllRows ? "$(play) Run all rows" : "$(play) Run";
  const debugTitle = runAllRows ? "$(debug) Debug all rows" : "$(debug) Debug";
  return makeRunLenses(range, target, runTitle, debugTitle);
}

function makeOutlineRowLenses(
  range: vscode.Range,
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  example: OutlineExample,
): vscode.CodeLens[] {
  const target: RunTarget = {
    kind: "outlineRow",
    feature: stubFeature(feature),
    scenario: { ...scenario, examples: undefined },
    example,
  };
  return makeRunLenses(range, target, "$(play) Run row", "$(debug) Debug row");
}

function stubFeature(feature: FeatureInfo): FeatureInfo {
  return {
    name: feature.name,
    filePath: feature.filePath,
    tags: feature.tags,
    scenarios: [],
  };
}

function makeRunLenses(
  range: vscode.Range,
  target: RunTarget,
  runTitle: string,
  debugTitle: string,
): vscode.CodeLens[] {
  return [
    new vscode.CodeLens(range, {
      title: runTitle,
      command: "bddPilot.runFromCodeLens",
      arguments: [target, false],
    }),
    new vscode.CodeLens(range, {
      title: debugTitle,
      command: "bddPilot.runFromCodeLens",
      arguments: [target, true],
    }),
  ];
}
