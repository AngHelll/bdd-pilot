import { OutlineExample } from "../gherkin/model";

/** How Scenario Outline rows map to `dotnet test --filter`. */
export type OutlineRowFilterStrategy = "displayName" | "scenarioOnly";

export interface FilterMappingConfig {
  /**
   * Suffix appended to the sanitized feature title for `FullyQualifiedName`
   * filters. Reqnroll/SpecFlow default is `Feature` (e.g. `LoginFeature`).
   * Set to empty string when the generated class has no suffix.
   */
  featureClassSuffix: string;
  /** xUnit trait name used for Gherkin tags (default `Category`). */
  tagTraitName: string;
  /**
   * `displayName` — one Theory row via VSTest `DisplayName~` (Reqnroll/xUnit).
   * `scenarioOnly` — whole Scenario Outline / Theory method.
   */
  outlineRowFilter: OutlineRowFilterStrategy;
}

export const DEFAULT_FILTER_MAPPING: FilterMappingConfig = {
  featureClassSuffix: "Feature",
  tagTraitName: "Category",
  outlineRowFilter: "displayName",
};

/**
 * Reqnroll maps Examples column headers to C# parameter names, e.g.
 * `expected_message` -> `expected_Message`.
 */
export function toReqnrollParamName(header: string): string {
  const idx = header.indexOf("_");
  if (idx === -1) {
    return header;
  }
  const first = header.slice(0, idx);
  const rest = header.slice(idx + 1);
  if (!rest) {
    return header;
  }
  return `${first}_${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/** Escapes characters that break VSTest filter grammar inside quoted values. */
export function escapeVstestFilterValue(value: string): string {
  return value.replace(/%/g, "%25").replace(/&/g, "%26").replace(/\|/g, "%7C");
}

/**
 * Builds a VSTest filter that targets a single xUnit Theory / Reqnroll outline row.
 * Uses URL-encoded double quotes (`%22`) so the filter survives argv parsing.
 */
export function buildOutlineRowFilter(example: OutlineExample): string | undefined {
  const fragments = example.headers
    .map((header, idx) => {
      const value = (example.values[idx] ?? "").trim();
      if (!value) {
        return undefined;
      }
      const param = toReqnrollParamName(header);
      const encoded = escapeVstestFilterValue(value);
      return `${param}: %22${encoded}%22`;
    })
    .filter((fragment): fragment is string => !!fragment);

  if (fragments.length === 0) {
    return undefined;
  }
  return `DisplayName~${fragments.join(", ")}`;
}
