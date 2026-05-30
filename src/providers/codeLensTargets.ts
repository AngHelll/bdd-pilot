import { FeatureInfo } from "../core/gherkin/model";
import { parseFeature } from "../core/gherkin/parser";
import { RunTarget } from "../core/runner/filterBuilder";

export interface CodeLensTargetEntry {
  line: number;
  target: RunTarget;
}

/** Pure helper for unit tests and CodeLens provider. */
export function buildCodeLensTargets(filePath: string, content: string): CodeLensTargetEntry[] {
  const feature = parseFeature(filePath, content);
  const entries: CodeLensTargetEntry[] = [];

  const featureLine = findFeatureLine(content);
  if (featureLine >= 0) {
    entries.push({
      line: featureLine + 1,
      target: {
        kind: "feature",
        feature: stubFeature(feature, filePath),
      },
    });
  }

  for (const scenario of feature.scenarios) {
    entries.push({
      line: scenario.line,
      target: {
        kind: "scenario",
        feature: stubFeature(feature, filePath),
        scenario: { ...scenario, examples: undefined },
      },
    });

    for (const example of scenario.examples ?? []) {
      entries.push({
        line: example.line,
        target: {
          kind: "outlineRow",
          feature: stubFeature(feature, filePath),
          scenario: { ...scenario, examples: undefined },
          example,
        },
      });
    }
  }

  return entries;
}

function findFeatureLine(content: string): number {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(?:Feature|Característica|Funcionalidad)\s*:/i.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function stubFeature(feature: FeatureInfo, filePath: string): FeatureInfo {
  return {
    name: feature.name,
    filePath,
    tags: feature.tags,
    scenarios: [],
  };
}
