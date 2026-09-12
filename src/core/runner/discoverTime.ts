export const DISCOVER_LIST_TIMEOUT_MS = 15_000;

export type DiscoverTimeKind =
  | "zero"
  | "empty_scope"
  | "one_vs_many"
  | "many_vs_one"
  | "aligned"
  | "unknown";

export type DiscoverTimeHint = "filter_or_target" | "empty_gherkin_scope" | "review_filter_or_outline";

export interface DiscoverTimeInput {
  listed?: number;
  gherkin?: number;
}

export interface DiscoverTimeResult {
  kind: DiscoverTimeKind;
  listed?: number;
  gherkin?: number;
  hint?: DiscoverTimeHint;
}

export function classifyDiscoverTime(input: DiscoverTimeInput): DiscoverTimeResult {
  const { listed, gherkin } = input;
  if (listed === undefined && gherkin === undefined) {
    return { kind: "aligned" };
  }
  if (gherkin === 0) {
    return { kind: "empty_scope", listed, gherkin, hint: "empty_gherkin_scope" };
  }
  if (listed === undefined) {
    return { kind: "unknown", listed, gherkin };
  }
  if (listed === 0 && gherkin !== undefined && gherkin > 0) {
    return { kind: "zero", listed, gherkin, hint: "filter_or_target" };
  }
  if (listed === 1 && gherkin !== undefined && gherkin > 1) {
    return { kind: "one_vs_many", listed, gherkin, hint: "review_filter_or_outline" };
  }
  if (gherkin === 1 && listed > 1) {
    return { kind: "many_vs_one", listed, gherkin, hint: "review_filter_or_outline" };
  }
  return { kind: "aligned", listed, gherkin };
}

/** Output line. Silent when aligned or unknown. */
export function formatDiscoverTimeLine(result: DiscoverTimeResult): string | undefined {
  if (result.kind === "aligned" || result.kind === "unknown") {
    return undefined;
  }
  const listedPart = result.listed === undefined ? "-" : String(result.listed);
  const gherkinPart = result.gherkin === undefined ? "-" : String(result.gherkin);
  const hintSuffix = result.hint ? ` · hint=${result.hint}` : "";
  return `Discover: listed=${listedPart} gherkin=${gherkinPart}${hintSuffix}`;
}

export function shouldProbeDiscoverList(input: {
  targets: Array<{ kind: string }>;
  filter?: string;
  rawFilter?: boolean;
  debug?: boolean;
}): boolean {
  if (input.rawFilter || input.debug) {
    return false;
  }
  if (!input.filter?.trim()) {
    return false;
  }
  if (input.targets.length === 0 || input.targets.some((target) => target.kind === "all")) {
    return false;
  }
  return true;
}
