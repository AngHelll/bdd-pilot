import * as vscode from "vscode";
import { RunTarget } from "../core/runner/filterBuilder";

export type CodeLensRunHandler = (target: RunTarget, debug: boolean) => void | Promise<void>;

/**
 * Shows "Run" / "Debug" CodeLens above Feature and Scenario lines in .feature files.
 */
export function registerFeatureCodeLens(): vscode.Disposable {
  const provider: vscode.CodeLensProvider = {
    provideCodeLenses(document) {
      if (!document.fileName.toLowerCase().endsWith(".feature")) {
        return [];
      }
      const lenses: vscode.CodeLens[] = [];
      const lines = document.getText().split(/\r?\n/);
      let pendingTags: string[] = [];
      let featureName: string | undefined;

      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (line.length === 0 || line.startsWith("#")) {
          continue;
        }
        if (isTagLine(line)) {
          pendingTags.push(...extractTags(line));
          continue;
        }
        const featureMatch = /^\s*(?:Feature|Característica|Funcionalidad)\s*:\s*(.+)$/i.exec(raw);
        if (featureMatch && !featureName) {
          featureName = featureMatch[1].trim();
          pendingTags = [];
          lenses.push(...makeLenses(i, "feature", featureName, document.uri, featureName));
          continue;
        }
        const scenarioMatch =
          /^\s*(?:Scenario|Scenario Outline|Scenario Template|Esquema del escenario)\s*:\s*(.+)$/i.exec(
            raw,
          );
        if (scenarioMatch && featureName) {
          const scenarioName = scenarioMatch[1].trim();
          lenses.push(
            ...makeLenses(i, "scenario", scenarioName, document.uri, featureName, i + 1, pendingTags),
          );
          pendingTags = [];
        } else if (!scenarioMatch && !featureMatch) {
          pendingTags = [];
        }
      }
      return lenses;
    },
  };

  return vscode.languages.registerCodeLensProvider({ pattern: "**/*.feature" }, provider);
}

function makeLenses(
  line: number,
  kind: "feature" | "scenario",
  name: string,
  uri: vscode.Uri,
  featureName: string,
  scenarioLine?: number,
  tags: string[] = [],
): vscode.CodeLens[] {
  const range = new vscode.Range(line, 0, line, 0);
  const runTarget: RunTarget =
    kind === "feature"
      ? { kind: "feature", feature: { name, filePath: uri.fsPath, tags, scenarios: [] } }
      : {
          kind: "scenario",
          feature: { name: featureName, filePath: uri.fsPath, tags: [], scenarios: [] },
          scenario: { name, tags, line: scenarioLine ?? line + 1, isOutline: false },
        };

  return [
    new vscode.CodeLens(range, {
      title: "$(play) Run",
      command: "bddPilot.runFromCodeLens",
      arguments: [runTarget, false],
    }),
    new vscode.CodeLens(range, {
      title: "$(debug) Debug",
      command: "bddPilot.runFromCodeLens",
      arguments: [runTarget, true],
    }),
  ];
}

function isTagLine(line: string): boolean {
  return line.startsWith("@") && line.replace(/(^|\s)@[^\s@]+/g, "").trim().length === 0;
}

function extractTags(line: string): string[] {
  const matches = line.match(/(^|\s)@[^\s@]+/g) || [];
  return matches.map((t) => t.trim().replace(/^@/, "")).filter(Boolean);
}
