import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { effectiveScenarioTags } from "../gherkin/tags";
import { discoverDomains } from "../gherkin/discovery";
import { RunTarget } from "./filterBuilder";

/** Counts executable tests for a run scope (outline rows count individually). */
export function estimateTestCount(targets: RunTarget[], projectDir: string): number | undefined {
  if (targets.length === 0 || targets.some((t) => t.kind === "all")) {
    return countAllTests(discoverDomains(projectDir));
  }

  let total = 0;
  let hasScope = false;

  for (const target of targets) {
    const n = countForTarget(target, projectDir);
    if (n !== undefined) {
      total += n;
      hasScope = true;
    }
  }

  return hasScope ? total : undefined;
}

function countAllTests(domains: DomainGroup[]): number {
  let n = 0;
  for (const domain of domains) {
    for (const feature of domain.features) {
      n += countFeatureTests(feature);
    }
  }
  return n;
}

function countForTarget(target: RunTarget, projectDir: string): number | undefined {
  switch (target.kind) {
    case "all":
      return countAllTests(discoverDomains(projectDir));
    case "domain":
      return target.group.features.reduce((sum, f) => sum + countFeatureTests(f), 0);
    case "feature":
      return countFeatureTests(target.feature);
    case "scenario":
      return countScenarioTests(target.scenario);
    case "outlineRow":
      return 1;
    case "tag": {
      const domains = discoverDomains(projectDir);
      let n = 0;
      for (const domain of domains) {
        for (const feature of domain.features) {
          for (const scenario of feature.scenarios) {
            if (effectiveScenarioTags(feature, scenario).includes(target.tag)) {
              n += countScenarioTests(scenario);
            }
          }
        }
      }
      return n;
    }
  }
}

function countFeatureTests(feature: FeatureInfo): number {
  return feature.scenarios.reduce((sum, s) => sum + countScenarioTests(s), 0);
}

function countScenarioTests(scenario: ScenarioInfo): number {
  if (scenario.examples && scenario.examples.length > 0) {
    return scenario.examples.length;
  }
  return 1;
}
