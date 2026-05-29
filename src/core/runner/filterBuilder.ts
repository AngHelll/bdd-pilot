import { DomainGroup, FeatureInfo, ScenarioInfo } from "../gherkin/model";

export type RunTarget =
  | { kind: "all" }
  | { kind: "domain"; group: DomainGroup }
  | { kind: "feature"; feature: FeatureInfo }
  | { kind: "scenario"; feature: FeatureInfo; scenario: ScenarioInfo }
  | { kind: "tag"; tag: string };

/**
 * Builds the value for `dotnet test --filter`.
 *
 * Reqnroll/xUnit expose Gherkin tags as `Category` traits and the generated
 * test class/method names via `FullyQualifiedName`. Reqnroll names the generated
 * test class `<SanitizedFeatureName>Feature`, so we anchor on that suffix:
 *   - feature   -> FullyQualifiedName~<SanitizedFeatureName>Feature
 *   - scenario  -> FullyQualifiedName~<SanitizedFeatureName>Feature.<SanitizedScenarioName>
 *   - tag       -> Category=<tag>
 *
 * Returns `undefined` for "run all" (no filter needed).
 */
export function buildFilter(target: RunTarget): string | undefined {
  switch (target.kind) {
    case "all":
      return undefined;
    case "tag":
      return `Category=${target.tag}`;
    case "domain": {
      const clauses = target.group.features
        .map((f) => `FullyQualifiedName~${featureClassName(f.name)}`)
        .filter((c, i, arr) => arr.indexOf(c) === i);
      return clauses.length > 0 ? clauses.join("|") : undefined;
    }
    case "feature":
      return `FullyQualifiedName~${featureClassName(target.feature.name)}`;
    case "scenario": {
      const cls = featureClassName(target.feature.name);
      const scenario = sanitizeIdentifier(target.scenario.name);
      return `FullyQualifiedName~${cls}.${scenario}`;
    }
  }
}

/**
 * The generated xUnit test class name for a feature. Reqnroll appends the
 * literal "Feature" suffix to the sanitized feature title (e.g. "Login" ->
 * "LoginFeature", "Stocks" -> "StocksFeature"). Guards against feature titles
 * that already end in "Feature" to avoid a doubled suffix.
 */
export function featureClassName(featureName: string): string {
  const sanitized = sanitizeIdentifier(featureName);
  return /Feature$/.test(sanitized) ? sanitized : `${sanitized}Feature`;
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
