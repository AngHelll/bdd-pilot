import * as path from "path";
import type { RunTarget } from "../runner/filterBuilder";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "./model";

/** Match a stub feature (e.g. CodeLens metadata) to discovered domain data. */
export function resolveFeatureInDomains(
  stub: FeatureInfo,
  domains: DomainGroup[],
): FeatureInfo | undefined {
  const stubPath = path.normalize(stub.filePath);
  for (const domain of domains) {
    for (const feature of domain.features) {
      if (path.normalize(feature.filePath) === stubPath) {
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

/** Match stub feature + scenario against discovered domain data. */
export function resolveScenarioInDomains(
  stubFeature: FeatureInfo,
  stubScenario: ScenarioInfo,
  domains: DomainGroup[],
): { feature: FeatureInfo; scenario: ScenarioInfo } | undefined {
  const feature = resolveFeatureInDomains(stubFeature, domains);
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

export type ExecutableTargetResolution =
  | { status: "ready"; targets: RunTarget[] }
  | { status: "unresolved" };

/**
 * Replaces feature and scenario stubs (CodeLens sends scenarios/examples empty)
 * with the discovered domain metadata. Other target kinds pass through.
 * A miss is unresolved: callers must not widen the run to the whole suite.
 */
export function resolveExecutableTargets(
  targets: RunTarget[],
  domains: DomainGroup[],
): ExecutableTargetResolution {
  const resolved: RunTarget[] = [];
  for (const target of targets) {
    if (target.kind === "feature") {
      const feature = resolveFeatureInDomains(target.feature, domains);
      if (!feature) {
        return { status: "unresolved" };
      }
      resolved.push({ kind: "feature", feature });
      continue;
    }
    if (target.kind === "scenario") {
      const match = resolveScenarioInDomains(target.feature, target.scenario, domains);
      if (!match) {
        return { status: "unresolved" };
      }
      resolved.push({
        kind: "scenario",
        feature: match.feature,
        scenario: match.scenario,
      });
      continue;
    }
    resolved.push(target);
  }
  return { status: "ready", targets: resolved };
}
