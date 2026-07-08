import { tagsMatch } from "../gherkin/groupByTag";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";
import { effectiveScenarioTags } from "../gherkin/tags";
import { findOutlineExampleMatch, matchesScenario } from "../results/scenarioMatch";
import { RunTarget } from "./filterBuilder";

export interface RunTargetMatch {
  target: RunTarget;
  feature: FeatureInfo;
  scenario: ScenarioInfo;
}

/** Maps a TRX testName to a run target + feature/scenario (outline → scenario targets first). */
export function matchRunTarget(
  targets: RunTarget[],
  testName: string,
  domains: DomainGroup[] = [],
): RunTargetMatch | undefined {
  for (const target of targets) {
    if (target.kind === "outlineRow") {
      if (findOutlineExampleMatch(testName, target.scenario.name, [target.example])) {
        return { target, feature: target.feature, scenario: target.scenario };
      }
    }
  }

  for (const target of targets) {
    if (target.kind === "scenario" && matchesScenario(testName, target.scenario.name)) {
      return { target, feature: target.feature, scenario: target.scenario };
    }
  }

  for (const target of targets) {
    if (target.kind === "feature") {
      for (const scenario of target.feature.scenarios) {
        if (matchesScenario(testName, scenario.name)) {
          return {
            target: { kind: "scenario", feature: target.feature, scenario },
            feature: target.feature,
            scenario,
          };
        }
      }
    }
  }

  for (const target of targets) {
    if (target.kind === "domain") {
      for (const feature of target.group.features) {
        for (const scenario of feature.scenarios) {
          if (matchesScenario(testName, scenario.name)) {
            return {
              target: { kind: "scenario", feature, scenario },
              feature,
              scenario,
            };
          }
        }
      }
    }
  }

  for (const target of targets) {
    if (target.kind === "tag") {
      for (const domain of domains) {
        for (const feature of domain.features) {
          for (const scenario of feature.scenarios) {
            if (!effectiveScenarioTags(feature, scenario).some((tag) => tagsMatch(tag, target.tag))) {
              continue;
            }
            if (matchesScenario(testName, scenario.name)) {
              return {
                target: { kind: "scenario", feature, scenario },
                feature,
                scenario,
              };
            }
          }
        }
      }
    }
  }

  return undefined;
}
