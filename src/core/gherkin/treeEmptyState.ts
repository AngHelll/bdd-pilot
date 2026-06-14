import { DomainGroup } from "./model";

export type TreeEmptyKind =
  | "none"
  | "no_project"
  | "no_features"
  | "search_no_match";

export interface TreeEmptyStateInput {
  hasProject: boolean;
  totalFeatureCount: number;
  visibleFeatureCount: number;
  searchActive: boolean;
}

export function countFeaturesInDomains(domains: DomainGroup[]): number {
  return domains.reduce((n, d) => n + d.features.length, 0);
}

export function resolveTreeEmptyKind(input: TreeEmptyStateInput): TreeEmptyKind {
  if (!input.hasProject) {
    return "no_project";
  }
  if (input.totalFeatureCount === 0) {
    return "no_features";
  }
  if (input.searchActive && input.visibleFeatureCount === 0) {
    return "search_no_match";
  }
  return "none";
}
