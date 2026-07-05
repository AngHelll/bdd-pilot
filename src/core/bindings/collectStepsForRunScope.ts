import * as fs from "fs";
import * as path from "path";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { parseFeatureStepLocations, StepLocation } from "../gherkin/stepLocations";
import { tagsMatch } from "../gherkin/groupByTag";
import { effectiveScenarioTags } from "../gherkin/tags";
import { RunTarget } from "../runner/filterBuilder";

export function shouldSkipBindingGate(rawFilter?: string, targets: RunTarget[] = []): boolean {
  if (rawFilter?.trim()) {
    return true;
  }
  return targets.length === 0;
}

function stepKey(location: StepLocation): string {
  return `${location.featurePath}::${location.line0}`;
}

function dedupeLocations(locations: StepLocation[]): StepLocation[] {
  const seen = new Set<string>();
  const out: StepLocation[] = [];
  for (const loc of locations) {
    const key = stepKey(loc);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(loc);
  }
  return out;
}

function readFeatureSteps(featurePath: string): StepLocation[] {
  try {
    const content = fs.readFileSync(featurePath, "utf8");
    return parseFeatureStepLocations(featurePath, content);
  } catch {
    return [];
  }
}

function locationsForFeature(
  feature: FeatureInfo,
  includeScenario: (scenario: ScenarioInfo) => boolean,
): StepLocation[] {
  const allSteps = readFeatureSteps(feature.filePath);
  const out: StepLocation[] = [];

  for (const step of allSteps) {
    if (step.scenarioName === "Background") {
      continue;
    }
    const scenario = feature.scenarios.find((s) => s.name === step.scenarioName);
    if (scenario && includeScenario(scenario)) {
      out.push(step);
    }
  }

  const needsBackground = feature.scenarios.some((s) => includeScenario(s));
  if (needsBackground) {
    for (const step of allSteps) {
      if (step.scenarioName === "Background") {
        out.push(step);
      }
    }
  }

  return out;
}

function resolveFeature(stub: FeatureInfo, domains: DomainGroup[]): FeatureInfo | undefined {
  for (const domain of domains) {
    for (const feature of domain.features) {
      if (path.normalize(feature.filePath) === path.normalize(stub.filePath)) {
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

function appendLocationsForTarget(
  target: RunTarget,
  domains: DomainGroup[],
  bucket: StepLocation[],
): void {
  switch (target.kind) {
    case "all":
      return;
    case "domain":
      for (const feature of target.group.features) {
        bucket.push(...locationsForFeature(feature, () => true));
      }
      return;
    case "feature": {
      const feature = resolveFeature(target.feature, domains);
      if (feature) {
        bucket.push(...locationsForFeature(feature, () => true));
      }
      return;
    }
    case "scenario": {
      const resolved = resolveScenario(target.feature, target.scenario, domains);
      if (resolved) {
        bucket.push(
          ...locationsForFeature(
            resolved.feature,
            (s) => s.line === resolved.scenario.line && s.name === resolved.scenario.name,
          ),
        );
      }
      return;
    }
    case "outlineRow": {
      const resolved = resolveScenario(target.feature, target.scenario, domains);
      if (resolved) {
        bucket.push(
          ...locationsForFeature(
            resolved.feature,
            (s) => s.line === resolved.scenario.line && s.name === resolved.scenario.name,
          ),
        );
      }
      return;
    }
    case "tag":
      for (const domain of domains) {
        for (const feature of domain.features) {
          bucket.push(
            ...locationsForFeature(feature, (scenario) =>
              effectiveScenarioTags(feature, scenario).some((t) => tagsMatch(t, target.tag)),
            ),
          );
        }
      }
      return;
  }
}

/**
 * Collects deduplicated step locations for the binding pre-run gate.
 */
export function collectStepsForRunScope(
  targets: RunTarget[],
  domains: DomainGroup[],
  rawFilter?: string,
): StepLocation[] {
  if (shouldSkipBindingGate(rawFilter, targets)) {
    return [];
  }

  if (targets.some((t) => t.kind === "all")) {
    const bucket: StepLocation[] = [];
    for (const domain of domains) {
      for (const feature of domain.features) {
        bucket.push(...readFeatureSteps(feature.filePath));
      }
    }
    return dedupeLocations(bucket);
  }

  const bucket: StepLocation[] = [];
  for (const target of targets) {
    appendLocationsForTarget(target, domains, bucket);
  }
  return dedupeLocations(bucket);
}
