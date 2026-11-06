import { FeatureInfo, OutlineExample, ScenarioInfo } from "./model";

/** Feature-level tags followed by scenario tags, deduplicated case-insensitively. */
export function effectiveScenarioTags(feature: FeatureInfo, scenario: ScenarioInfo): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...feature.tags, ...scenario.tags]) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(tag);
    }
  }
  return merged;
}

/** Tags of the Examples block that produced this row. They do not belong to the scenario. */
export function outlineExampleTags(example: OutlineExample | undefined): string[] {
  return example?.tags ? [...example.tags] : [];
}

/** Scenario-only tags (excluding feature inheritance). */
export function scenarioOwnTags(feature: FeatureInfo, scenario: ScenarioInfo): string[] {
  const featureKeys = new Set(feature.tags.map((t) => t.toLowerCase()));
  return scenario.tags.filter((t) => !featureKeys.has(t.toLowerCase()));
}
