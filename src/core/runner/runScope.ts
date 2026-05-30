import { discoverDomains } from "../gherkin/discovery";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { effectiveScenarioTags } from "../gherkin/tags";
import { RunTarget } from "./filterBuilder";

export function scenarioKey(feature: FeatureInfo, scenario: ScenarioInfo): string {
  return `${feature.filePath}::${scenario.line}::${scenario.name}`;
}

export function outlineRowKey(feature: FeatureInfo, scenario: ScenarioInfo, rowIndex: number): string {
  return `${scenarioKey(feature, scenario)}::row${rowIndex}`;
}

/**
 * Outcome keys affected by a run. Returns `"all"` for full-suite runs.
 * Returns an empty set when scope is unknown (e.g. raw profile filter) so
 * prior decorations can be merged instead of wiped.
 */
export function collectOutcomeKeysForTargets(
  targets: RunTarget[],
  domains: DomainGroup[],
): Set<string> | "all" {
  if (targets.length === 0) {
    return new Set();
  }
  if (targets.some((t) => t.kind === "all")) {
    return "all";
  }

  const keys = new Set<string>();
  for (const target of targets) {
    appendKeysForTarget(target, domains, keys);
  }
  return keys;
}

/** Resolves domains from disk when targets carry stub feature metadata (CodeLens). */
export function collectOutcomeKeysForTargetsInProject(
  targets: RunTarget[],
  projectDir: string,
): Set<string> | "all" {
  return collectOutcomeKeysForTargets(targets, discoverDomains(projectDir));
}

function appendKeysForTarget(target: RunTarget, domains: DomainGroup[], keys: Set<string>): void {
  switch (target.kind) {
    case "all":
      return;
    case "domain":
      for (const feature of target.group.features) {
        appendFeatureKeys(feature, keys);
      }
      return;
    case "feature": {
      const feature = resolveFeature(target.feature, domains);
      if (feature) {
        appendFeatureKeys(feature, keys);
      }
      return;
    }
    case "scenario": {
      const resolved = resolveScenario(target.feature, target.scenario, domains);
      if (resolved) {
        appendScenarioKeys(resolved.feature, resolved.scenario, keys);
      }
      return;
    }
    case "outlineRow": {
      const resolved = resolveScenario(target.feature, target.scenario, domains);
      if (resolved) {
        keys.add(outlineRowKey(resolved.feature, resolved.scenario, target.example.rowIndex));
      }
      return;
    }
    case "tag":
      for (const domain of domains) {
        for (const feature of domain.features) {
          for (const scenario of feature.scenarios) {
            if (effectiveScenarioTags(feature, scenario).includes(target.tag)) {
              appendScenarioKeys(feature, scenario, keys);
            }
          }
        }
      }
      return;
  }
}

function appendFeatureKeys(feature: FeatureInfo, keys: Set<string>): void {
  for (const scenario of feature.scenarios) {
    appendScenarioKeys(feature, scenario, keys);
  }
}

function appendScenarioKeys(feature: FeatureInfo, scenario: ScenarioInfo, keys: Set<string>): void {
  if (scenario.examples && scenario.examples.length > 0) {
    for (const example of scenario.examples) {
      keys.add(outlineRowKey(feature, scenario, example.rowIndex));
    }
  } else {
    keys.add(scenarioKey(feature, scenario));
  }
}

function resolveFeature(stub: FeatureInfo, domains: DomainGroup[]): FeatureInfo | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      if (feature.filePath === stub.filePath) {
        return feature;
      }
    }
  }
  for (const domain of domains) {
    for (const feature of domain.features) {
      if (feature.name === stub.name) {
        return feature;
      }
    }
  }
  return undefined;
}

function resolveScenario(
  stubFeature: FeatureInfo,
  stubScenario: ScenarioInfo,
  domains: DomainGroup[],
): { feature: FeatureInfo; scenario: ScenarioInfo } | undefined {
  const feature = resolveFeature(stubFeature, domains);
  if (!feature) {
    return undefined;
  }
  const scenario =
    feature.scenarios.find(
      (s) => s.line === stubScenario.line && s.name === stubScenario.name,
    ) ?? feature.scenarios.find((s) => s.name === stubScenario.name);
  if (!scenario) {
    return undefined;
  }
  return { feature, scenario };
}
