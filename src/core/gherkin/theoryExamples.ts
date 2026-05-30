import { buildExampleLabel } from "./parser";
import { FeatureInfo, OutlineExample, ScenarioInfo } from "./model";
import { parseTheoryDisplayName } from "../runner/theoryDisplayName";
import { normalizeName } from "../results/scenarioMatch";

/**
 * Builds outline example rows from xUnit theory display names when the feature
 * file has parameterized steps but no Examples / Scenarios table.
 */
export function inferExamplesFromTestNames(
  scenario: ScenarioInfo,
  testNames: string[],
): OutlineExample[] {
  const normalizedScenario = normalizeName(scenario.name);
  const rows: OutlineExample[] = [];
  const seen = new Set<string>();

  for (const testName of testNames) {
    const parsed = parseTheoryDisplayName(testName);
    if (!parsed) {
      continue;
    }
    if (normalizeName(parsed.title) !== normalizedScenario) {
      continue;
    }

    const headers = parsed.params.map((p) => p.name);
    const values = parsed.params.map((p) => p.value);
    const label = buildExampleLabel(headers, values);
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);

    rows.push({
      rowIndex: rows.length,
      line: scenario.line,
      headers,
      values,
      label,
    });
  }

  return rows;
}

export function scenarioNeedsTheoryDiscovery(scenario: ScenarioInfo): boolean {
  if (scenario.examples && scenario.examples.length > 0) {
    return false;
  }
  const params = scenario.stepParams ?? [];
  return scenario.isOutline || params.length > 0;
}

/** Mutates features in place when theory rows can be inferred from test names. */
export function enrichFeaturesWithTheoryTests(
  features: FeatureInfo[],
  testNames: string[],
): number {
  let enriched = 0;
  for (const feature of features) {
    for (const scenario of feature.scenarios) {
      if (!scenarioNeedsTheoryDiscovery(scenario)) {
        continue;
      }
      const inferred = inferExamplesFromTestNames(scenario, testNames);
      if (inferred.length === 0) {
        continue;
      }
      scenario.examples = inferred;
      if (!scenario.isOutline) {
        scenario.isOutline = true;
      }
      enriched++;
    }
  }
  return enriched;
}
