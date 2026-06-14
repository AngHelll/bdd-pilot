import * as assert from "assert";
import { describe, it } from "node:test";
import {
  countFeaturesInDomains,
  resolveTreeEmptyKind,
} from "../core/gherkin/treeEmptyState";
import { DomainGroup } from "../core/gherkin/model";
import { FeatureInfo } from "../core/gherkin/model";

function stubFeature(): FeatureInfo {
  return {
    filePath: "Features/F.feature",
    name: "Feature",
    tags: [],
    scenarios: [],
  };
}

function domainsWithFeatures(count: number): DomainGroup[] {
  if (count === 0) {
    return [];
  }
  return [{ name: "Features", features: Array.from({ length: count }, stubFeature) }];
}

describe("treeEmptyState", () => {
  it("resolveTreeEmptyKind returns no_project when hasProject is false", () => {
    assert.strictEqual(
      resolveTreeEmptyKind({
        hasProject: false,
        totalFeatureCount: 0,
        visibleFeatureCount: 0,
        searchActive: false,
      }),
      "no_project",
    );
  });

  it("resolveTreeEmptyKind returns no_features when project has zero features", () => {
    assert.strictEqual(
      resolveTreeEmptyKind({
        hasProject: true,
        totalFeatureCount: 0,
        visibleFeatureCount: 0,
        searchActive: false,
      }),
      "no_features",
    );
  });

  it("resolveTreeEmptyKind returns search_no_match when filter hides all features", () => {
    assert.strictEqual(
      resolveTreeEmptyKind({
        hasProject: true,
        totalFeatureCount: 3,
        visibleFeatureCount: 0,
        searchActive: true,
      }),
      "search_no_match",
    );
  });

  it("resolveTreeEmptyKind returns none when features are visible", () => {
    assert.strictEqual(
      resolveTreeEmptyKind({
        hasProject: true,
        totalFeatureCount: 2,
        visibleFeatureCount: 2,
        searchActive: false,
      }),
      "none",
    );
  });

  it("resolveTreeEmptyKind returns none when search active but matches remain", () => {
    assert.strictEqual(
      resolveTreeEmptyKind({
        hasProject: true,
        totalFeatureCount: 5,
        visibleFeatureCount: 1,
        searchActive: true,
      }),
      "none",
    );
  });

  it("countFeaturesInDomains sums features across domains", () => {
    assert.strictEqual(countFeaturesInDomains(domainsWithFeatures(0)), 0);
    assert.strictEqual(countFeaturesInDomains(domainsWithFeatures(3)), 3);
  });
});
