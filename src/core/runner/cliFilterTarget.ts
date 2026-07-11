import * as path from "path";
import { RUN_SCOPE_ALL_TESTS_LABEL, formatRunTargetScopeLabels } from "../diagnostics/aiFailureContext";
import { discoverDomains } from "../gherkin/discovery";
import { FeatureInfo } from "../gherkin/model";
import { groupByTag, tagsMatch } from "../gherkin/groupByTag";
import { RunTarget } from "./filterBuilder";

export type CliFilterOptions =
  | { kind: "all" }
  | { kind: "tag"; tag: string }
  | { kind: "feature"; featurePath: string; scenarioName?: string };

export class CliFilterNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliFilterNotFoundError";
  }
}

function findFeatureByPath(domains: ReturnType<typeof discoverDomains>, projectDir: string, featurePath: string): FeatureInfo | undefined {
  const normalizedPath = featurePath.replace(/\\/g, "/");
  const basename = path.basename(normalizedPath).toLowerCase();

  for (const domain of domains) {
    for (const feature of domain.features) {
      const rel = path.relative(projectDir, feature.filePath).split(path.sep).join("/");
      if (rel.toLowerCase() === normalizedPath.toLowerCase()) {
        return feature;
      }
      if (path.basename(feature.filePath).toLowerCase() === basename) {
        return feature;
      }
    }
  }
  return undefined;
}

/** Resolves CLI scope flags to a RunTarget and human scope label. */
export function resolveCliFilterTarget(
  projectDir: string,
  opts: CliFilterOptions,
): { target: RunTarget; scopeLabel: string } {
  const absProjectDir = path.resolve(projectDir);

  if (opts.kind === "all") {
    return { target: { kind: "all" }, scopeLabel: RUN_SCOPE_ALL_TESTS_LABEL };
  }

  const domains = discoverDomains(absProjectDir);

  if (opts.kind === "tag") {
    const normalizedTag = opts.tag.trim().replace(/^@/, "");
    const tagGroups = groupByTag(domains);
    const group = tagGroups.find((entry) => tagsMatch(entry.tag, normalizedTag));
    if (!group || group.scenarios.length === 0) {
      throw new CliFilterNotFoundError(`Tag not found: ${opts.tag}`);
    }
    const target: RunTarget = { kind: "tag", tag: group.tag };
    return { target, scopeLabel: formatRunTargetScopeLabels([target])[0] };
  }

  const feature = findFeatureByPath(domains, absProjectDir, opts.featurePath);
  if (!feature) {
    throw new CliFilterNotFoundError(`Feature not found: ${opts.featurePath}`);
  }

  if (opts.scenarioName !== undefined) {
    const scenarioName = opts.scenarioName.trim();
    const scenario = feature.scenarios.find((entry) => entry.name === scenarioName);
    if (!scenario) {
      throw new CliFilterNotFoundError(`Scenario not found: ${opts.scenarioName}`);
    }
    const target: RunTarget = { kind: "scenario", feature, scenario };
    return { target, scopeLabel: formatRunTargetScopeLabels([target])[0] };
  }

  const target: RunTarget = { kind: "feature", feature };
  return { target, scopeLabel: formatRunTargetScopeLabels([target])[0] };
}
