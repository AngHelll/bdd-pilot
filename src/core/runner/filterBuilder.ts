import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../gherkin/model";
import {
  DEFAULT_FILTER_MAPPING,
  FilterMappingConfig,
  buildOutlineRowFilter,
} from "./filterMapping";

export type RunTarget =
  | { kind: "all" }
  | { kind: "domain"; group: DomainGroup }
  | { kind: "feature"; feature: FeatureInfo }
  | { kind: "scenario"; feature: FeatureInfo; scenario: ScenarioInfo }
  | {
      kind: "outlineRow";
      feature: FeatureInfo;
      scenario: ScenarioInfo;
      example: OutlineExample;
    }
  | { kind: "tag"; tag: string };

/**
 * Builds the value for `dotnet test --filter`.
 *
 * Reqnroll/xUnit expose Gherkin tags as `Category` traits and the generated
 * test class/method names via `FullyQualifiedName`. Reqnroll names the generated
 * test class `<SanitizedFeatureName>Feature` by default — configurable via
 * `FilterMappingConfig.featureClassSuffix`.
 *
 * Scenario Outline rows use VSTest `DisplayName~` when
 * `outlineRowFilter` is `displayName` (Reqnroll/xUnit Theory rows).
 *
 * Returns `undefined` for "run all" (no filter needed).
 */
export function buildFilter(
  target: RunTarget,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): string | undefined {
  switch (target.kind) {
    case "all":
      return undefined;
    case "tag":
      return `${mapping.tagTraitName}=${target.tag}`;
    case "domain": {
      const clauses = target.group.features
        .map((f) => `FullyQualifiedName~${featureClassName(f.name, mapping)}`)
        .filter((c, i, arr) => arr.indexOf(c) === i);
      return clauses.length > 0 ? clauses.join("|") : undefined;
    }
    case "feature":
      return `FullyQualifiedName~${featureClassName(target.feature.name, mapping)}`;
    case "scenario":
      return buildScenarioFilter(target.feature, target.scenario, mapping);
    case "outlineRow": {
      if (mapping.outlineRowFilter === "scenarioOnly") {
        return buildScenarioFilter(target.feature, target.scenario, mapping);
      }
      return buildOutlineRowFilter(target.example) ?? buildScenarioFilter(target.feature, target.scenario, mapping);
    }
  }
}

function buildScenarioFilter(
  feature: FeatureInfo,
  scenario: ScenarioInfo,
  mapping: FilterMappingConfig,
): string {
  const cls = featureClassName(feature.name, mapping);
  const scenarioId = sanitizeIdentifier(scenario.name);
  return `FullyQualifiedName~${cls}.${scenarioId}`;
}

/**
 * Combines multiple run targets into a single `dotnet test --filter` value by
 * OR-joining their clauses with `|`. Returns `undefined` (run everything) when
 * there are no targets or any target is "all". Used by the native Test Explorer
 * integration where an arbitrary set of items can be selected.
 */
export function buildCombinedFilter(
  targets: RunTarget[],
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): string | undefined {
  if (targets.length === 0 || targets.some((t) => t.kind === "all")) {
    return undefined;
  }
  const clauses: string[] = [];
  for (const target of targets) {
    const clause = buildFilter(target, mapping);
    if (clause && !clauses.includes(clause)) {
      clauses.push(clause);
    }
  }
  return clauses.length > 0 ? clauses.join("|") : undefined;
}

/**
 * The generated xUnit test class name for a feature. Reqnroll appends the
 * configured suffix (default `Feature`) to the sanitized feature title.
 */
export function featureClassName(
  featureName: string,
  mapping: FilterMappingConfig = DEFAULT_FILTER_MAPPING,
): string {
  const sanitized = sanitizeIdentifier(featureName);
  const suffix = mapping.featureClassSuffix;
  if (!suffix) {
    return sanitized;
  }
  return sanitized.endsWith(suffix) ? sanitized : `${sanitized}${suffix}`;
}

/**
 * Reqnroll generates C# identifiers from feature/scenario names by stripping
 * non-alphanumeric characters and PascalCasing word boundaries. We approximate
 * that here for a usable substring match.
 */
export function sanitizeIdentifier(name: string): string {
  const words = name
    .replace(/['"]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}
