import * as path from "path";
import { discoverDomains } from "./discovery";
import { groupByTag } from "./groupByTag";
import { scenarioOwnTags } from "./tags";
import { enrichFeaturesWithTheoryTests } from "./theoryExamples";
import { DomainGroup } from "./model";
import { listDotnetTests, ListTestsRequest } from "../runner/listTests";
import { sanitize } from "../../security/sanitizer";

export const DISCOVER_ENRICH_TIMEOUT_MS = 90_000;

export interface CliDiscoverExampleReport {
  label: string;
  headers: string[];
  values: string[];
}

export interface CliDiscoverScenarioReport {
  name: string;
  line: number;
  tags: string[];
  isOutline: boolean;
  exampleCount?: number;
  examples?: CliDiscoverExampleReport[];
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
  enriched?: boolean;
  executableTestCount?: number;
  listTestsWarnings?: string[];
}

export type ListTestsFn = (req: ListTestsRequest, signal?: AbortSignal) => Promise<string[]>;

export interface BuildCliDiscoverReportOptions {
  enrich?: boolean;
  testTarget?: string;
  dotnetPath?: string;
  timeoutMs?: number;
  listTests?: ListTestsFn;
}

function serializeDomains(
  absProjectDir: string,
  domains: DomainGroup[],
  includeExamples: boolean,
): Omit<CliDiscoverReport, "enriched" | "executableTestCount" | "listTestsWarnings"> {
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
          if (includeExamples && scenario.examples && scenario.examples.length > 0) {
            item.examples = scenario.examples.map((example) => ({
              label: example.label,
              headers: [...example.headers],
              values: [...example.values],
            }));
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

async function runListTestsWithTimeout(
  req: ListTestsRequest,
  timeoutMs: number,
  listTests: ListTestsFn,
): Promise<{ testNames?: string[]; warning?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const testNames = await listTests(req, controller.signal);
    return { testNames };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { warning: sanitize(`list-tests timed out after ${timeoutMs}ms`) };
    }
    return { warning: sanitize(raw) };
  } finally {
    clearTimeout(timer);
  }
}

/** Builds the JSON payload for `pilot discover`. */
export async function buildCliDiscoverReport(
  projectDir: string,
  options?: BuildCliDiscoverReportOptions,
): Promise<CliDiscoverReport> {
  const absProjectDir = path.resolve(projectDir);
  const domains = discoverDomains(absProjectDir);

  if (!options?.enrich) {
    return serializeDomains(absProjectDir, domains, false);
  }

  const listTests = options.listTests ?? listDotnetTests;
  const timeoutMs = options.timeoutMs ?? DISCOVER_ENRICH_TIMEOUT_MS;
  const { testNames, warning } = await runListTestsWithTimeout(
    {
      dotnetPath: options.dotnetPath ?? "dotnet",
      projectDir: absProjectDir,
      testTarget: options.testTarget,
    },
    timeoutMs,
    listTests,
  );

  const warnings = warning ? [warning] : [];
  if (!testNames) {
    return {
      ...serializeDomains(absProjectDir, domains, false),
      listTestsWarnings: warnings,
    };
  }

  for (const domain of domains) {
    enrichFeaturesWithTheoryTests(domain.features, testNames);
  }

  return {
    ...serializeDomains(absProjectDir, domains, true),
    enriched: true,
    executableTestCount: testNames.length,
    listTestsWarnings: warnings.length > 0 ? warnings : undefined,
  };
}
