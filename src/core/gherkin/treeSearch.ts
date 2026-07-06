import { tagsMatch } from "./groupByTag";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "./model";
import { effectiveScenarioTags } from "./tags";
import { RunTarget } from "../runner/filterBuilder";

export const TREE_SEARCH_WORKSPACE_KEY = "bddPilot.treeSearchQuery";
export const FILTER_CHIP_MAX_LEN = 40;

export function isTagOnlyQuery(query: string): boolean {
  return query.startsWith("@");
}

export function tagQueryFromAtSyntax(query: string): string {
  return query.startsWith("@") ? query.slice(1) : query;
}

export function normalizeSearchQuery(display: string): string {
  return display.trim().toLowerCase();
}

export function filterDomainsBySearch(allDomains: DomainGroup[], query: string): DomainGroup[] {
  if (!query) {
    return allDomains;
  }
  return allDomains
    .map((domain) => ({
      name: domain.name,
      features: domain.features
        .map((feature) => ({
          ...feature,
          scenarios: feature.scenarios.filter((s) => matchesSearch(query, feature, s)),
        }))
        .filter((feature) => matchesSearch(query, feature) || feature.scenarios.length > 0),
    }))
    .filter((domain) => {
      if (domain.features.length > 0) {
        return true;
      }
      if (isTagOnlyQuery(query)) {
        return false;
      }
      return domain.name.toLowerCase().includes(query);
    });
}

export function matchesSearch(query: string, feature: FeatureInfo, scenario?: ScenarioInfo): boolean {
  if (isTagOnlyQuery(query)) {
    const tagNeedle = tagQueryFromAtSyntax(query);
    if (!tagNeedle) {
      return true;
    }
    if (scenario) {
      return effectiveScenarioTags(feature, scenario).some((t) => tagsMatch(t, tagNeedle));
    }
    if (feature.tags.some((t) => tagsMatch(t, tagNeedle))) {
      return true;
    }
    return feature.scenarios.some((s) =>
      effectiveScenarioTags(feature, s).some((t) => tagsMatch(t, tagNeedle)),
    );
  }

  const haystack = [
    feature.name,
    feature.filePath,
    ...feature.tags.map((t) => `@${t}`),
    scenario?.name ?? "",
    ...(scenario ? effectiveScenarioTags(feature, scenario).map((t) => `@${t}`) : []),
    ...(scenario?.examples?.map((ex) => ex.label) ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function tagGroupMatchesSearch(groupTag: string, scenarioCount: number, query: string): boolean {
  if (!query) {
    return true;
  }
  if (scenarioCount > 0) {
    return true;
  }
  if (isTagOnlyQuery(query)) {
    return tagsMatch(groupTag, tagQueryFromAtSyntax(query));
  }
  const lower = query.toLowerCase();
  return groupTag.toLowerCase().includes(lower) || `@${groupTag}`.toLowerCase().includes(lower);
}

export function collectFilteredRunTargets(domains: DomainGroup[]): RunTarget[] {
  const targets: RunTarget[] = [];
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        if (scenario.examples && scenario.examples.length > 0) {
          for (const example of scenario.examples) {
            targets.push({ kind: "outlineRow", feature, scenario, example });
          }
        } else {
          targets.push({ kind: "scenario", feature, scenario });
        }
      }
    }
  }
  return targets;
}

export function shouldConfirmSearchRunCap(leafCount: number, cap: number): boolean {
  return cap > 0 && leafCount > cap;
}
