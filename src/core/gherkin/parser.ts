import { FeatureInfo, ScenarioInfo } from "./model";

const FEATURE_RE = /^\s*(?:Feature|Característica|Funcionalidad)\s*:\s*(.*)$/i;
const SCENARIO_RE = /^\s*(?:Scenario|Escenario)\s*:\s*(.*)$/i;
const OUTLINE_RE =
  /^\s*(?:Scenario Outline|Scenario Template|Esquema del escenario)\s*:\s*(.*)$/i;
const TAG_RE = /(^|\s)@[^\s@]+/g;

/**
 * Lightweight, dependency-free Gherkin parser.
 *
 * It extracts the feature name + tags and each scenario / scenario outline with
 * its own tags and line number. Tags are accumulated until a non-tag, non-blank,
 * non-comment line is reached, then attached to whatever block follows.
 */
export function parseFeature(filePath: string, content: string): FeatureInfo {
  const lines = content.split(/\r?\n/);

  const feature: FeatureInfo = {
    name: "",
    filePath,
    tags: [],
    scenarios: [],
  };

  let pendingTags: string[] = [];
  let featureSeen = false;

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

    const featureMatch = FEATURE_RE.exec(raw);
    if (featureMatch && !featureSeen) {
      feature.name = featureMatch[1].trim();
      feature.tags = pendingTags;
      pendingTags = [];
      featureSeen = true;
      continue;
    }

    const outlineMatch = OUTLINE_RE.exec(raw);
    if (outlineMatch) {
      feature.scenarios.push(makeScenario(outlineMatch[1], pendingTags, i + 1, true));
      pendingTags = [];
      continue;
    }

    const scenarioMatch = SCENARIO_RE.exec(raw);
    if (scenarioMatch) {
      feature.scenarios.push(makeScenario(scenarioMatch[1], pendingTags, i + 1, false));
      pendingTags = [];
      continue;
    }

    // Any other keyword line (Given/When/Then/Background/Examples...) clears
    // pending tags that were not consumed by a feature or scenario.
    pendingTags = [];
  }

  if (feature.name.length === 0) {
    feature.name = fileBaseName(filePath);
  }

  return feature;
}

function makeScenario(
  name: string,
  tags: string[],
  line: number,
  isOutline: boolean,
): ScenarioInfo {
  return { name: name.trim(), tags: [...tags], line, isOutline };
}

function isTagLine(line: string): boolean {
  return line.startsWith("@") && line.replace(TAG_RE, "").trim().length === 0;
}

export function extractTags(line: string): string[] {
  const matches = line.match(TAG_RE) || [];
  return matches.map((t) => t.trim().replace(/^@/, "")).filter((t) => t.length > 0);
}

function fileBaseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const last = parts[parts.length - 1] || filePath;
  return last.replace(/\.feature$/i, "");
}
