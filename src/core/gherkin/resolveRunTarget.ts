import * as path from "path";
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
