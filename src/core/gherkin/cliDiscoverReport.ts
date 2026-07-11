import * as path from "path";
import { discoverDomains } from "./discovery";
import { groupByTag } from "./groupByTag";
import { scenarioOwnTags } from "./tags";

export interface CliDiscoverScenarioReport {
  name: string;
  line: number;
  tags: string[];
  isOutline: boolean;
  exampleCount?: number;
}

export interface CliDiscoverFeatureReport {
  name: string;
  path: string;
  tags: string[];
  scenarios: CliDiscoverScenarioReport[];
}

export interface CliDiscoverDomainReport {
  name: string;
  features: CliDiscoverFeatureReport[];
}

export interface CliDiscoverTagReport {
  tag: string;
  scenarioCount: number;
}

export interface CliDiscoverReport {
  projectDir: string;
  featureCount: number;
  scenarioCount: number;
  domains: CliDiscoverDomainReport[];
  tags: CliDiscoverTagReport[];
}

/** Builds the JSON payload for `pilot discover`. */
export function buildCliDiscoverReport(projectDir: string): CliDiscoverReport {
  const absProjectDir = path.resolve(projectDir);
  const domains = discoverDomains(absProjectDir);
  const tagGroups = groupByTag(domains);

  let featureCount = 0;
  let scenarioCount = 0;

  const domainReports: CliDiscoverDomainReport[] = domains.map((domain) => {
    const features: CliDiscoverFeatureReport[] = domain.features.map((feature) => {
      featureCount += 1;
      scenarioCount += feature.scenarios.length;

      return {
        name: feature.name,
        path: path.relative(absProjectDir, feature.filePath).split(path.sep).join("/"),
        tags: [...feature.tags],
        scenarios: feature.scenarios.map((scenario) => {
          const item: CliDiscoverScenarioReport = {
            name: scenario.name,
            line: scenario.line,
            tags: scenarioOwnTags(feature, scenario),
            isOutline: scenario.isOutline,
          };
          if (scenario.isOutline && scenario.examples && scenario.examples.length > 0) {
            item.exampleCount = scenario.examples.length;
          }
          return item;
        }),
      };
    });

    return { name: domain.name, features };
  });

  return {
    projectDir: absProjectDir,
    featureCount,
    scenarioCount,
    domains: domainReports,
    tags: tagGroups.map((group) => ({
      tag: group.tag,
      scenarioCount: group.scenarios.length,
    })),
  };
}
