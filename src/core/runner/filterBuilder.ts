import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../gherkin/model";
import { resolveScenarioInDomains } from "../gherkin/resolveRunTarget";
import {
  DEFAULT_FILTER_MAPPING,
  FilterMappingConfig,
  buildOutlineRowFilter,
} from "./filterMapping";
import { toReqnrollIdentifierPart } from "./reqnrollIdentifier";

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
      const cells = buildOutlineRowFilter(target.example);
      const scenarioFilter = buildScenarioFilter(target.feature, target.scenario, mapping);
      if (!cells) {
        return scenarioFilter;
      }
      return `(${scenarioFilter}&${cells})`;
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
 * Reqnroll-generated C# identifier from a feature/scenario title.
 * @see toReqnrollIdentifierPart — hyphens become `_` (e.g. Pre-order → Pre_Order).
 */
export function sanitizeIdentifier(name: string): string {
  return toReqnrollIdentifierPart(name);
}

/**
 * True when another Examples row in the same scenario produces the same cell
 * filter. The run keeps the row clause and does not widen to the scenario.
 */
export function selectionHasIndistinguishableOutlineRow(
  targets: RunTarget[],
  domains: DomainGroup[] = [],
): boolean {
  for (const target of targets) {
    if (target.kind !== "outlineRow") {
      continue;
    }
    const scenario =
      resolveScenarioInDomains(target.feature, target.scenario, domains)?.scenario ??
      target.scenario;
    if (outlineRowCellsCollide(scenario, target.example)) {
      return true;
    }
  }
  return false;
}

function outlineRowCellsCollide(scenario: ScenarioInfo, example: OutlineExample): boolean {
  const selected = buildOutlineRowFilter(example);
  if (!selected) {
    return false;
  }
  let matches = 0;
  for (const row of scenario.examples ?? []) {
    if (buildOutlineRowFilter(row) === selected) {
      matches += 1;
    }
  }
  return matches > 1;
}
