import { DomainGroup, FeatureInfo, ScenarioInfo } from "./model";
import { effectiveScenarioTags } from "./tags";

export interface TagScenarioRef {
  feature: FeatureInfo;
  scenario: ScenarioInfo;
}

export interface TagGroup {
  /** Tag without leading `@` (preserves first-seen casing). */
  tag: string;
  scenarios: TagScenarioRef[];
}

/**
 * Builds tag → scenarios index from discovered domains. A scenario appears once
 * per effective tag (feature + scenario tags). Untagged scenarios are omitted.
 */
export function groupByTag(domains: DomainGroup[]): TagGroup[] {
  const byKey = new Map<string, { tag: string; scenarios: TagScenarioRef[] }>();

  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        for (const tag of effectiveScenarioTags(feature, scenario)) {
          const key = tag.toLowerCase();
          let group = byKey.get(key);
          if (!group) {
            group = { tag, scenarios: [] };
            byKey.set(key, group);
          }
          if (!hasScenario(group.scenarios, feature, scenario)) {
            group.scenarios.push({ feature, scenario });
          }
        }
      }
    }
  }

  return Array.from(byKey.values())
    .map(({ tag, scenarios }) => ({
      tag,
      scenarios: scenarios.sort(compareTagScenarioRef),
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }));
}

function hasScenario(refs: TagScenarioRef[], feature: FeatureInfo, scenario: ScenarioInfo): boolean {
  return refs.some(
    (ref) => ref.feature.filePath === feature.filePath && ref.scenario.line === scenario.line,
  );
}

function compareTagScenarioRef(a: TagScenarioRef, b: TagScenarioRef): number {
  const featureCmp = a.feature.name.localeCompare(b.feature.name, undefined, { sensitivity: "base" });
  if (featureCmp !== 0) {
    return featureCmp;
  }
  return a.scenario.name.localeCompare(b.scenario.name, undefined, { sensitivity: "base" });
}

/** Case-insensitive tag equality for filters and tree grouping. */
export function tagsMatch(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
